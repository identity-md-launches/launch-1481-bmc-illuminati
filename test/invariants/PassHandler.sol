// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BMCIlluminatiPass} from "../../src/BMCIlluminatiPass.sol";
import {MisbehavingBMC} from "../mocks/MisbehavingBMC.sol";

/// @dev Minimal EIP-2935 history contract stand-in used by the history-enabled invariant suite.
contract HandlerBlockHistory {
    mapping(uint256 => bytes32) public hashes;

    function set(uint256 n, bytes32 h) external {
        hashes[n] = h;
    }

    fallback(bytes calldata input) external returns (bytes memory) {
        require(input.length == 32, "bad input");
        bytes32 h = hashes[abi.decode(input, (uint256))];
        require(h != bytes32(0), "unknown block");
        return abi.encode(h);
    }
}

/// @title PassHandler
/// @notice Drives one BMCIlluminatiPass through random, bounded call sequences on behalf of a few
///         actors, exercising the failure paths (wrong phase, underfunding, misbehaving token,
///         unauthorized gate calls, bad transfers) as deliberately as the happy ones. Every action
///         decides up front whether the call must succeed or revert, asserts that, and keeps ghost
///         accounting for the invariants in the test contracts.
contract PassHandler is Test {
    uint256 constant GENESIS_PRICE = 1_000_000e18;
    uint256 constant MYSTERY_PRICE = 350_000e18;

    BMCIlluminatiPass public immutable pass;
    MisbehavingBMC public immutable bmc;
    address public immutable owner;
    HandlerBlockHistory public immutable history; // zero address when history is disabled
    address public immutable victim; // funded non-actor used by the BurnFromOther token mode

    address[] public actors;

    // ---------------------------------------------------------------- ghost accounting
    uint256 public ghostFunded; // all BMC ever minted by this handler (actors + victim)
    uint256 public ghostBurned; // BMC destroyed by mints the handler saw succeed
    uint256 public ghostTotalMinted; // successful mints the handler saw
    uint256 public ghostGenesisMints;
    uint256 public ghostMysteryMints;
    uint256 public ghostRevealed; // tokens whose outcome the handler recorded
    uint256 public ghostForcedReveals; // outcomes settled after the hash window expired
    uint256 public ghostMysteryGenesis; // Genesis outcomes recorded from the mystery pool
    uint256 public ghostMysteryStandard;
    bool public ghostOpened; // the handler saw openMinting succeed
    uint256 public ghostLastTotalMinted;
    uint256 public ghostLastRevealed;
    uint256 public ghostLastBurned;

    mapping(address => uint256) public ghostFundedOf;
    mapping(address => uint256) public ghostSpentOf;
    mapping(uint256 tokenId => bytes32) public ghostOutcome; // keccak(tier, artwork) once revealed
    mapping(uint256 artwork => bool) public ghostGenesisArtSeen;
    mapping(uint256 artwork => bool) public ghostStandardArtSeen;

    // ---------------------------------------------------------------- call coverage counters
    uint256 public callsGenesisOk;
    uint256 public callsGenesisRejected;
    uint256 public callsMysteryOk;
    uint256 public callsMysteryRejected;
    uint256 public callsRevealed;
    uint256 public callsUnderfundedRejected;
    uint256 public callsTransferOk;
    uint256 public callsTransferRejected;
    uint256 public callsOpenOk;
    uint256 public callsOpenRejected;
    uint256 public callsTokenFaultRejected;

    constructor(BMCIlluminatiPass pass_, MisbehavingBMC bmc_, address owner_, bool withHistory) {
        pass = pass_;
        bmc = bmc_;
        owner = owner_;
        actors.push(makeAddr("actor-1"));
        actors.push(makeAddr("actor-2"));
        actors.push(makeAddr("actor-3"));
        actors.push(makeAddr("actor-4"));
        victim = makeAddr("victim");
        bmc_.setVictim(victim);
        bmc_.setSink(makeAddr("sink"));
        _fund(victim, 10 * GENESIS_PRICE);
        if (withHistory) {
            HandlerBlockHistory impl = new HandlerBlockHistory();
            vm.etch(pass_.BLOCK_HISTORY(), address(impl).code);
            history = HandlerBlockHistory(pass_.BLOCK_HISTORY());
        } else {
            history = HandlerBlockHistory(address(0));
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    // ---------------------------------------------------------------- internals

    function _fund(address who, uint256 amount) internal {
        bmc.mint(who, amount);
        ghostFunded += amount;
        ghostFundedOf[who] += amount;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    /// @dev Token modes under which the pass must accept the burn (the pass cannot see whether an
    ///      allowance was spent, only that the balance and supply fell by exactly the price).
    function _tokenHonest() internal view returns (bool) {
        MisbehavingBMC.Mode m = bmc.mode();
        return m == MisbehavingBMC.Mode.Honest || m == MisbehavingBMC.Mode.NoAllowanceCheck;
    }

    modifier monotonic() {
        assertGe(pass.totalMinted(), ghostLastTotalMinted, "totalMinted decreased");
        assertGe(pass.revealedCount(), ghostLastRevealed, "revealedCount decreased");
        assertGe(pass.totalBurned(), ghostLastBurned, "totalBurned decreased");
        _;
        ghostLastTotalMinted = pass.totalMinted();
        ghostLastRevealed = pass.revealedCount();
        ghostLastBurned = pass.totalBurned();
    }

    struct Snapshot {
        uint256 minted;
        uint256 burned;
        uint256 supply;
        uint256 balance;
        uint256 revealed;
    }

    function _snap(address who) internal view returns (Snapshot memory s) {
        s.minted = pass.totalMinted();
        s.burned = pass.totalBurned();
        s.supply = bmc.totalSupply();
        s.balance = bmc.balanceOf(who);
        s.revealed = pass.revealedCount();
    }

    function _assertUnchanged(Snapshot memory s, address who) internal view {
        assertEq(pass.totalMinted(), s.minted, "rejected call changed totalMinted");
        assertEq(pass.totalBurned(), s.burned, "rejected call changed totalBurned");
        assertEq(bmc.totalSupply(), s.supply, "rejected call changed BMC supply");
        assertEq(bmc.balanceOf(who), s.balance, "rejected call changed payer balance");
        assertEq(pass.revealedCount(), s.revealed, "rejected call changed revealedCount");
    }

    function _mintGenesisOnce(address who) internal {
        _fund(who, GENESIS_PRICE);
        vm.prank(who);
        bmc.approve(address(pass), GENESIS_PRICE);

        Snapshot memory s = _snap(who);
        bool shouldSucceed = pass.mintingOpen() && s.minted < 40 && _tokenHonest();

        vm.prank(who);
        try pass.mintGenesis() returns (uint256 id) {
            assertTrue(shouldSucceed, "genesis mint succeeded when it had to revert");
            assertEq(id, s.minted + 1, "genesis ids are sequential");
            assertEq(pass.ownerOf(id), who, "minter owns the token");
            assertEq(pass.totalBurned(), s.burned + GENESIS_PRICE, "burn accounted");
            assertEq(bmc.totalSupply(), s.supply - GENESIS_PRICE, "BMC destroyed");
            assertEq(bmc.balanceOf(who), s.balance - GENESIS_PRICE, "payer charged exactly the price");
            assertEq(pass.artworkIdOf(id), uint16(id), "genesis artwork follows the id");
            BMCIlluminatiPass.Tier t = pass.tierOf(id);
            if (id == 1) assertEq(uint8(t), uint8(BMCIlluminatiPass.Tier.LegendaryGenesis), "token 1 legendary");
            else assertEq(uint8(t), uint8(BMCIlluminatiPass.Tier.Genesis), "tokens 2..40 genesis");
            assertEq(uint8(pass.revealStatusOf(id)), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
            assertFalse(ghostGenesisArtSeen[id], "duplicate genesis artwork");
            ghostGenesisArtSeen[id] = true;
            ghostOutcome[id] = keccak256(abi.encode(t, uint16(id)));
            ghostBurned += GENESIS_PRICE;
            ghostSpentOf[who] += GENESIS_PRICE;
            ghostTotalMinted += 1;
            ghostGenesisMints += 1;
            callsGenesisOk += 1;
        } catch {
            assertFalse(shouldSucceed, "genesis mint reverted when it had to succeed");
            _assertUnchanged(s, who);
            if (_tokenHonest()) callsGenesisRejected += 1;
            else callsTokenFaultRejected += 1;
        }
        _restoreToken();
    }

    function _mintMysteryOnce(address who) internal {
        _fund(who, MYSTERY_PRICE);
        vm.prank(who);
        bmc.approve(address(pass), MYSTERY_PRICE);

        Snapshot memory s = _snap(who);
        bool shouldSucceed = pass.mintingOpen() && s.minted >= 40 && s.minted < 500 && _tokenHonest();

        vm.prank(who);
        try pass.mintMystery() returns (uint256 id) {
            assertTrue(shouldSucceed, "mystery mint succeeded when it had to revert");
            assertEq(id, s.minted + 1, "mystery ids are sequential");
            assertEq(pass.ownerOf(id), who);
            assertEq(pass.totalBurned(), s.burned + MYSTERY_PRICE);
            assertEq(bmc.totalSupply(), s.supply - MYSTERY_PRICE);
            assertEq(bmc.balanceOf(who), s.balance - MYSTERY_PRICE);
            assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Pending), "fresh mystery is pending");
            assertEq(pass.artworkIdOf(id), 0, "pending token has no artwork");
            assertEq(pass.revealBlockOf(id), block.number + 1, "reveal block is the next block");
            assertEq(pass.revealDeadlineOf(id), block.number + 1 + pass.REVEAL_WINDOW());
            assertEq(
                uint8(pass.revealStatusOf(id)),
                uint8(BMCIlluminatiPass.RevealStatus.AwaitingRandomness),
                "nothing to reveal yet"
            );
            ghostBurned += MYSTERY_PRICE;
            ghostSpentOf[who] += MYSTERY_PRICE;
            ghostTotalMinted += 1;
            ghostMysteryMints += 1;
            callsMysteryOk += 1;
        } catch {
            assertFalse(shouldSucceed, "mystery mint reverted when it had to succeed");
            _assertUnchanged(s, who);
            if (_tokenHonest()) callsMysteryRejected += 1;
            else callsTokenFaultRejected += 1;
        }
        _restoreToken();
    }

    // ---------------------------------------------------------------- actions

    /// @notice One Genesis mint attempt by a random actor, in whatever phase/token state we are.
    function mintGenesis(uint256 actorSeed) external monotonic {
        _mintGenesisOnce(_actor(actorSeed));
    }

    /// @notice Up to ten Genesis attempts so a sequence can actually finish phase 1.
    function mintGenesisBatch(uint256 actorSeed, uint256 n) external monotonic {
        n = bound(n, 1, 10);
        uint256 base = bound(actorSeed, 0, actors.length - 1);
        for (uint256 i; i < n; ++i) {
            _mintGenesisOnce(actors[(base + i) % actors.length]);
        }
    }

    function mintMystery(uint256 actorSeed) external monotonic {
        _mintMysteryOnce(_actor(actorSeed));
    }

    /// @notice Up to twenty Mystery attempts so a sequence can reach a sold-out collection.
    function mintMysteryBatch(uint256 actorSeed, uint256 n) external monotonic {
        n = bound(n, 1, 20);
        uint256 base = bound(actorSeed, 0, actors.length - 1);
        for (uint256 i; i < n; ++i) {
            _mintMysteryOnce(actors[(base + i) % actors.length]);
        }
    }

    /// @notice A mint with an allowance or balance one unit short must revert and change nothing.
    function mintUnderfunded(uint256 actorSeed, uint256 shortfallSeed, bool genesis) external monotonic {
        address who = _actor(actorSeed);
        uint256 price = genesis ? GENESIS_PRICE : MYSTERY_PRICE;
        uint256 shortfall = bound(shortfallSeed, 1, price);
        // Give the payer exactly the price and approve less than it (or approve the price and hold less).
        uint256 have = bmc.balanceOf(who);
        // A token that ignores allowances can only be starved through the balance.
        bool starve = shortfallSeed % 2 == 0 || bmc.mode() == MisbehavingBMC.Mode.NoAllowanceCheck;
        if (starve) {
            // Keep the balance below the price by moving the surplus to the victim.
            if (have >= price) {
                vm.prank(who);
                bmc.transfer(victim, have - price + shortfall);
                ghostFundedOf[who] -= have - price + shortfall;
                ghostFundedOf[victim] += have - price + shortfall;
            }
            vm.prank(who);
            bmc.approve(address(pass), price);
        } else {
            if (have < price) _fund(who, price - have);
            vm.prank(who);
            bmc.approve(address(pass), price - shortfall);
        }
        Snapshot memory s = _snap(who);
        vm.prank(who);
        if (genesis) {
            try pass.mintGenesis() {
                revert("underfunded genesis mint succeeded");
            } catch {}
        } else {
            try pass.mintMystery() {
                revert("underfunded mystery mint succeeded");
            } catch {}
        }
        _assertUnchanged(s, who);
        callsUnderfundedRejected += 1;
    }

    /// @notice Switch the payment token's behaviour for the next mint attempt; a faulty mode is
    ///         reset to honest after one attempt (see `_restoreToken`) so that every fault is
    ///         exercised without starving the rest of the sequence of successful mints.
    function setTokenMode(uint256 modeSeed) external monotonic {
        bmc.setMode(MisbehavingBMC.Mode(bound(modeSeed, 0, 6)));
    }

    function _restoreToken() internal {
        if (!_tokenHonest()) bmc.setMode(MisbehavingBMC.Mode.Honest);
    }

    /// @notice Settle up to `maxCount` pending tokens from a random caller and check each outcome.
    function reveal(uint256 actorSeed, uint256 maxCount) external monotonic {
        maxCount = bound(maxCount, 0, 520);
        uint256 minted = pass.totalMinted();
        uint256 revealedBefore = pass.revealedCount();
        uint256 first = 40 + revealedBefore + 1;

        // Expected count: consecutive tokens whose reveal block is strictly before the current block.
        uint256 expected;
        uint256 id = first;
        while (expected < maxCount && id <= minted && pass.revealBlockOf(id) < block.number) {
            ++expected;
            ++id;
        }
        uint256 standardLeft = pass.remainingMysteryStandard();
        uint256 genesisLeft = pass.remainingMysteryGenesis();

        vm.prank(_actor(actorSeed));
        uint256 got = pass.reveal(maxCount);
        assertEq(got, expected, "reveal count");
        assertEq(pass.revealedCount(), revealedBefore + expected, "revealedCount advanced by the batch");

        for (uint256 t = first; t < first + expected; ++t) {
            uint256 revealBlock = pass.revealBlockOf(t);
            uint256 age = block.number - revealBlock;
            bool hashAvailable = age <= 256
                || (age <= pass.REVEAL_WINDOW() && address(history) != address(0) && history.hashes(revealBlock) != 0);
            BMCIlluminatiPass.Tier tier = pass.tierOf(t);
            uint16 art = pass.artworkIdOf(t);
            assertEq(uint8(pass.revealStatusOf(t)), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
            if (tier == BMCIlluminatiPass.Tier.Genesis) {
                assertTrue(art >= 41 && art <= 77, "mystery genesis artwork range");
                assertFalse(ghostGenesisArtSeen[art], "duplicate genesis artwork");
                ghostGenesisArtSeen[art] = true;
                ghostMysteryGenesis += 1;
                assertTrue(genesisLeft > 0, "genesis drawn from an empty genesis pool");
                genesisLeft -= 1;
                // A forced settlement may only hand out Genesis when no Standard is left.
                if (!hashAvailable) {
                    assertEq(standardLeft, 0, "forced settlement gave Genesis while Standard remained");
                }
            } else {
                assertEq(uint8(tier), uint8(BMCIlluminatiPass.Tier.Standard), "revealed tier is genesis or standard");
                assertTrue(art >= 1 && art <= 423, "standard artwork range");
                assertFalse(ghostStandardArtSeen[art], "duplicate standard artwork");
                ghostStandardArtSeen[art] = true;
                ghostMysteryStandard += 1;
                assertTrue(standardLeft > 0, "standard drawn from an empty standard pool");
                standardLeft -= 1;
            }
            if (!hashAvailable) ghostForcedReveals += 1;
            ghostOutcome[t] = keccak256(abi.encode(tier, art));
            ghostRevealed += 1;
        }
        assertEq(pass.remainingMysteryStandard(), standardLeft, "standard pool accounting");
        assertEq(pass.remainingMysteryGenesis(), genesisLeft, "genesis pool accounting");
        callsRevealed += got;
    }

    /// @notice Advance 1..300 blocks, giving every passed block a seeded hash (and a history entry
    ///         when the EIP-2935 stand-in is enabled).
    function advanceBlocks(uint256 n, uint256 seed) external monotonic {
        n = bound(n, 1, 300);
        uint256 from = block.number;
        vm.roll(from + n);
        // Every passed block gets a history entry; only the 256 most recent can be read natively.
        for (uint256 b = from; b < from + n; ++b) {
            bytes32 h = keccak256(abi.encode("handler-block", b, seed));
            if (from + n - b <= 256) vm.setBlockhash(b, h);
            if (address(history) != address(0)) history.set(b, h);
        }
    }

    /// @notice Jump past the whole reveal window so every pending token settles as forced.
    function jumpPastWindow() external monotonic {
        vm.roll(block.number + pass.REVEAL_WINDOW() + 2);
    }

    /// @notice Transfer a random token between actors; a non-owner transfer must revert.
    function transfer(uint256 fromSeed, uint256 toSeed, uint256 tokenSeed) external monotonic {
        uint256 minted = pass.totalMinted();
        if (minted == 0) return;
        uint256 tokenId = bound(tokenSeed, 1, minted);
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        address holder = pass.ownerOf(tokenId);
        bytes32 outcomeBefore = ghostOutcome[tokenId];
        uint256 burnedBefore = pass.totalBurned();
        uint256 supplyBefore = bmc.totalSupply();
        vm.prank(from);
        try pass.transferFrom(from, to, tokenId) {
            assertEq(holder, from, "transfer by a non-owner succeeded");
            assertEq(pass.ownerOf(tokenId), to);
            callsTransferOk += 1;
        } catch {
            assertTrue(holder != from, "owner transfer reverted");
            assertEq(pass.ownerOf(tokenId), holder);
            callsTransferRejected += 1;
        }
        assertEq(pass.totalBurned(), burnedBefore, "transfer burned BMC");
        assertEq(bmc.totalSupply(), supplyBefore, "transfer changed BMC supply");
        if (outcomeBefore != bytes32(0)) {
            assertEq(
                keccak256(abi.encode(pass.tierOf(tokenId), pass.artworkIdOf(tokenId))),
                outcomeBefore,
                "transfer changed a settled outcome"
            );
        }
    }

    /// @notice Gate call from the owner or a random actor; only the owner may open, exactly once.
    function openMinting(uint256 callerSeed) external monotonic {
        bool asOwner = callerSeed % 3 == 0;
        address caller = asOwner ? owner : _actor(callerSeed);
        bool wasOpen = pass.mintingOpen();
        vm.prank(caller);
        try pass.openMinting() {
            assertTrue(asOwner, "non-owner opened minting");
            assertFalse(wasOpen, "opened twice");
            assertTrue(pass.mintingOpen());
            ghostOpened = true;
            callsOpenOk += 1;
        } catch (bytes memory reason) {
            if (!asOwner) {
                assertEq(
                    reason,
                    abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller),
                    "non-owner must fail authorization, not something else"
                );
            } else {
                assertTrue(wasOpen, "owner could not open a closed gate");
                assertEq(reason, abi.encodeWithSelector(BMCIlluminatiPass.MintingAlreadyOpen.selector));
            }
            assertEq(pass.mintingOpen(), wasOpen, "failed gate call changed the gate");
            callsOpenRejected += 1;
        }
    }
}
