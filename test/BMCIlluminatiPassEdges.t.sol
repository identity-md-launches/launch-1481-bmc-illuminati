// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {BMCIlluminatiPass} from "../src/BMCIlluminatiPass.sol";
import {MockBMC} from "./mocks/MockBMC.sol";
import {MisbehavingBMC, NoDecimalsBMC, RejectingReceiver, NoHookReceiver} from "./mocks/MisbehavingBMC.sol";

/// @dev EIP-2935 stand-ins with specific misbehaviour: a reverting one and one returning the wrong length.
contract RevertingHistory {
    fallback() external {
        revert("history down");
    }
}

contract WrongLengthHistory {
    fallback(bytes calldata) external returns (bytes memory) {
        return abi.encode(bytes32(uint256(1)), bytes32(uint256(2)));
    }
}

contract StoredHistory {
    mapping(uint256 => bytes32) public hashes;

    function set(uint256 n, bytes32 h) external {
        hashes[n] = h;
    }

    fallback(bytes calldata input) external returns (bytes memory) {
        bytes32 h = hashes[abi.decode(input, (uint256))];
        require(h != bytes32(0), "unknown block");
        return abi.encode(h);
    }
}

/// @dev Receiver that calls `reveal` from inside the mint callback.
contract RevealingReceiver is IERC721Receiver {
    BMCIlluminatiPass immutable pass;
    uint256 public revealedInCallback;
    uint8 public tierSeenInCallback;

    constructor(BMCIlluminatiPass p) {
        pass = p;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        revealedInCallback = pass.reveal(50);
        tierSeenInCallback = uint8(pass.tierOf(tokenId));
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @title Edge cases and failure paths for BMCIlluminatiPass
/// @notice Complements the main suite: boundaries of the reveal windows, misbehaving payment
///         tokens, rejecting receivers, re-entry into `reveal`, zero/max arguments and the exact
///         consequences of each rejected call.
contract BMCIlluminatiPassEdgesTest is Test {
    uint256 constant GENESIS_PRICE = 1_000_000e18;
    uint256 constant MYSTERY_PRICE = 350_000e18;
    bytes32 constant REVEALED_SIG = keccak256("Revealed(uint256,uint8,uint16,bool)");

    MockBMC bmc;
    BMCIlluminatiPass pass;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        bmc = new MockBMC();
        pass = new BMCIlluminatiPass(owner, address(bmc));
    }

    // ------------------------------------------------------------------ helpers

    function _mintGenesisAs(address who) internal returns (uint256 id) {
        bmc.mint(who, GENESIS_PRICE);
        vm.startPrank(who);
        bmc.approve(address(pass), GENESIS_PRICE);
        id = pass.mintGenesis();
        vm.stopPrank();
    }

    function _mintMysteryAs(address who) internal returns (uint256 id) {
        bmc.mint(who, MYSTERY_PRICE);
        vm.startPrank(who);
        bmc.approve(address(pass), MYSTERY_PRICE);
        id = pass.mintMystery();
        vm.stopPrank();
    }

    function _finishPhase1() internal {
        for (uint256 i; i < 40; ++i) {
            _mintGenesisAs(address(uint160(0x7000 + i)));
        }
    }

    function _outcome(uint256 id) internal view returns (bytes32) {
        return keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id)));
    }

    /// @dev Reveals one token and returns the `forced` flag from its Revealed event.
    function _revealOneAndReadForced(uint256 id) internal returns (bool forced) {
        vm.recordLogs();
        assertEq(pass.reveal(1), 1);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == REVEALED_SIG && uint256(logs[i].topics[1]) == id) {
                (,, forced) = abi.decode(logs[i].data, (uint8, uint16, bool));
                found = true;
            }
        }
        assertTrue(found, "Revealed event missing");
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }

    function _decodeTokenURI(uint256 id) internal view returns (string memory) {
        bytes memory b = bytes(pass.tokenURI(id));
        uint256 prefix = bytes("data:application/json;base64,").length;
        bytes memory payload = new bytes(b.length - prefix);
        for (uint256 i; i < payload.length; ++i) {
            payload[i] = b[i + prefix];
        }
        return string(_b64decode(payload));
    }

    function _b64decode(bytes memory data) internal pure returns (bytes memory out) {
        bytes memory table = bytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
        uint8[256] memory rev;
        for (uint8 i; i < 64; ++i) {
            rev[uint8(table[i])] = i;
        }
        uint256 len = data.length;
        uint256 pad;
        if (len > 0 && data[len - 1] == "=") pad++;
        if (len > 1 && data[len - 2] == "=") pad++;
        out = new bytes((len / 4) * 3 - pad);
        uint256 o;
        for (uint256 i; i < len; i += 4) {
            uint256 n = (uint256(rev[uint8(data[i])]) << 18) | (uint256(rev[uint8(data[i + 1])]) << 12)
                | (uint256(rev[uint8(data[i + 2])]) << 6) | uint256(rev[uint8(data[i + 3])]);
            if (o < out.length) out[o++] = bytes1(uint8(n >> 16));
            if (o < out.length) out[o++] = bytes1(uint8(n >> 8));
            if (o < out.length) out[o++] = bytes1(uint8(n));
        }
    }

    // ------------------------------------------------------------------ reveal arguments

    function test_RevealZeroCountIsANoopEvenWithFinalizedTokens() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        vm.roll(block.number + 2);
        assertEq(pass.reveal(0), 0);
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Pending));
        assertEq(pass.revealedCount(), 0);
    }

    function test_RevealWithNothingMintedOrOnlyGenesisReturnsZero() public {
        assertEq(pass.reveal(type(uint256).max), 0);
        _mintGenesisAs(alice);
        vm.roll(block.number + 5);
        assertEq(pass.reveal(type(uint256).max), 0);
        assertEq(pass.nextRevealId(), 0);
        assertEq(pass.pendingReveals(), 0);
    }

    /// forge-config: default.fuzz.runs = 256
    function testFuzz_RevealCountIsMinOfRequestAndFinalized(uint8 finalizedSeed, uint8 laterSeed, uint16 maxCount)
        public
    {
        uint256 finalized = bound(finalizedSeed, 0, 30);
        uint256 later = bound(laterSeed, 0, 30);
        _finishPhase1();
        for (uint256 i; i < finalized; ++i) {
            _mintMysteryAs(alice);
        }
        vm.roll(block.number + 1);
        for (uint256 i; i < later; ++i) {
            _mintMysteryAs(bob);
        }
        vm.roll(block.number + 1); // first group's reveal block is final, second group's is current
        uint256 expected = maxCount < finalized ? maxCount : finalized;
        assertEq(pass.reveal(maxCount), expected, "first batch");
        assertEq(pass.revealedCount(), expected);
        assertEq(pass.pendingReveals(), finalized + later - expected);
        // The second group is not settleable yet whatever the request size.
        assertEq(pass.reveal(1000), finalized - expected, "rest of first group");
        vm.roll(block.number + 1);
        assertEq(pass.reveal(1000), later, "second group");
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.nextRevealId(), 0);
    }

    // ------------------------------------------------------------------ hash window boundaries

    function test_NativeWindowBoundary_Age256SettlesFromHash_Age257IsForced() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = pass.revealBlockOf(id);
        vm.roll(revealBlock + 1);
        vm.setBlockhash(revealBlock, keccak256("window"));
        uint256 snap = vm.snapshotState();
        assertFalse(_revealOneAndReadForced(id), "age 1 is natural");
        bytes32 natural = _outcome(id);

        vm.revertToState(snap);
        vm.roll(revealBlock + 256);
        assertFalse(_revealOneAndReadForced(id), "age 256 still reads the native hash");
        assertEq(_outcome(id), natural, "same hash, same outcome");

        vm.revertToState(snap);
        vm.roll(revealBlock + 257);
        assertEq(blockhash(revealBlock), bytes32(0));
        assertTrue(_revealOneAndReadForced(id), "age 257 without a history contract is forced");
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Standard));
    }

    function test_HistoryWindowBoundary_Age8191Natural_Age8192Forced() public {
        _finishPhase1();
        StoredHistory impl = new StoredHistory();
        vm.etch(pass.BLOCK_HISTORY(), address(impl).code);
        StoredHistory history = StoredHistory(pass.BLOCK_HISTORY());
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = pass.revealBlockOf(id);
        bytes32 h = keccak256("deep history");
        history.set(revealBlock, h);
        vm.roll(revealBlock + 1);
        vm.setBlockhash(revealBlock, h);
        uint256 snap = vm.snapshotState();
        _revealOneAndReadForced(id);
        bytes32 natural = _outcome(id);

        vm.revertToState(snap);
        vm.roll(revealBlock + 8191);
        assertEq(block.number, pass.revealDeadlineOf(id));
        assertFalse(_revealOneAndReadForced(id), "the deadline block itself still settles from history");
        assertEq(_outcome(id), natural);

        vm.revertToState(snap);
        vm.roll(revealBlock + 8192);
        assertTrue(_revealOneAndReadForced(id), "one block past the deadline is forced");
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Standard));
    }

    function test_BrokenHistoryContractFallsBackToForcedStandard() public {
        _finishPhase1();
        uint256 a = _mintMysteryAs(alice);
        vm.roll(block.number + 1);
        uint256 b = _mintMysteryAs(bob);
        vm.roll(block.number + 300); // both beyond the native window

        uint256 snap = vm.snapshotState();
        vm.etch(pass.BLOCK_HISTORY(), address(new RevertingHistory()).code);
        assertTrue(_revealOneAndReadForced(a), "reverting history: forced");
        assertEq(uint8(pass.tierOf(a)), uint8(BMCIlluminatiPass.Tier.Standard));

        vm.revertToState(snap);
        vm.etch(pass.BLOCK_HISTORY(), address(new WrongLengthHistory()).code);
        assertTrue(_revealOneAndReadForced(a), "wrong return length: forced");
        assertEq(pass.reveal(1), 1);
        assertEq(uint8(pass.tierOf(b)), uint8(BMCIlluminatiPass.Tier.Standard));
        assertEq(pass.remainingMysteryGenesis(), 37, "forced settlements never consume Genesis while Standard remains");
    }

    function test_ForcedOutcomeIsDeterministicAcrossTimeAndCaller() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        uint256 deadline = pass.revealDeadlineOf(id);
        vm.roll(deadline + 1);
        uint256 snap = vm.snapshotState();
        pass.reveal(1);
        bytes32 first = _outcome(id);
        vm.revertToState(snap);
        vm.roll(deadline + 123_456);
        vm.warp(block.timestamp + 30 days);
        vm.prevrandao(bytes32(uint256(7)));
        vm.prank(bob);
        pass.reveal(1);
        assertEq(_outcome(id), first, "forced settlement depends on nothing but the token");
    }

    /// forge-config: default.fuzz.runs = 128
    function testFuzz_NaturalOutcomeIndependentOfCallerBatchAndClock(bytes32 word, uint8 callerSeed, uint16 maxCount)
        public
    {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = pass.revealBlockOf(id);
        vm.roll(revealBlock + 1);
        vm.setBlockhash(revealBlock, word);
        uint256 snap = vm.snapshotState();
        pass.reveal(1);
        bytes32 baseline = _outcome(id);
        vm.revertToState(snap);
        vm.roll(revealBlock + 1 + (uint256(callerSeed) % 250));
        vm.warp(block.timestamp + callerSeed);
        vm.prank(address(uint160(0x9000 + callerSeed)));
        pass.reveal(uint256(maxCount) + 1);
        assertEq(_outcome(id), baseline);
    }

    // ------------------------------------------------------------------ payment token failures

    function _misbehavingSetup(MisbehavingBMC.Mode mode) internal returns (MisbehavingBMC token, BMCIlluminatiPass p) {
        token = new MisbehavingBMC();
        p = new BMCIlluminatiPass(owner, address(token));
        token.setVictim(bob);
        token.setSink(makeAddr("sink"));
        token.mint(bob, GENESIS_PRICE);
        token.mint(alice, GENESIS_PRICE);
        vm.prank(alice);
        token.approve(address(p), GENESIS_PRICE);
        token.setMode(mode);
    }

    function test_TokenBurningOneUnitLessIsRejected() public {
        (MisbehavingBMC token, BMCIlluminatiPass p) = _misbehavingSetup(MisbehavingBMC.Mode.BurnLess);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BMCIlluminatiPass.BurnMismatch.selector, GENESIS_PRICE, GENESIS_PRICE - 1)
        );
        p.mintGenesis();
        assertEq(token.balanceOf(alice), GENESIS_PRICE);
        assertEq(p.totalMinted(), 0);
    }

    function test_TokenBurningFromSomebodyElseIsRejected() public {
        (MisbehavingBMC token, BMCIlluminatiPass p) = _misbehavingSetup(MisbehavingBMC.Mode.BurnFromOther);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.BurnMismatch.selector, GENESIS_PRICE, GENESIS_PRICE));
        p.mintGenesis();
        assertEq(token.balanceOf(bob), GENESIS_PRICE, "victim keeps its balance");
        assertEq(token.balanceOf(alice), GENESIS_PRICE);
    }

    function test_TokenRemintingToASinkIsRejected() public {
        (MisbehavingBMC token, BMCIlluminatiPass p) = _misbehavingSetup(MisbehavingBMC.Mode.BurnAndRemint);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.BurnMismatch.selector, GENESIS_PRICE, 0));
        p.mintGenesis();
        assertEq(token.totalSupply(), 2 * GENESIS_PRICE);
        assertEq(token.balanceOf(makeAddr("sink")), 0);
    }

    function test_TokenRevertingInBurnFromBubblesUp() public {
        (, BMCIlluminatiPass p) = _misbehavingSetup(MisbehavingBMC.Mode.Revert);
        vm.prank(alice);
        vm.expectRevert(bytes("MBMC: burnFrom disabled"));
        p.mintGenesis();
        assertEq(p.totalMinted(), 0);
    }

    function test_TokenWithoutDecimalsFunctionIsRejected() public {
        NoDecimalsBMC token = new NoDecimalsBMC();
        BMCIlluminatiPass p = new BMCIlluminatiPass(owner, address(token));
        token.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        token.approve(address(p), GENESIS_PRICE);
        vm.expectRevert();
        p.mintGenesis();
        vm.stopPrank();
        assertEq(token.balanceOf(alice), GENESIS_PRICE);
        assertEq(p.totalMinted(), 0);
    }

    function test_TokenFaultMidCollectionDoesNotCorruptAccounting() public {
        (MisbehavingBMC token, BMCIlluminatiPass p) = _misbehavingSetup(MisbehavingBMC.Mode.Honest);
        vm.prank(alice);
        assertEq(p.mintGenesis(), 1);
        token.setMode(MisbehavingBMC.Mode.WrongDecimals);
        token.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        token.approve(address(p), GENESIS_PRICE);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.UnexpectedTokenDecimals.selector, uint8(6)));
        p.mintGenesis();
        vm.stopPrank();
        token.setMode(MisbehavingBMC.Mode.Honest);
        vm.prank(alice);
        assertEq(p.mintGenesis(), 2);
        assertEq(p.totalBurned(), 2 * GENESIS_PRICE);
        assertEq(token.totalSupply(), GENESIS_PRICE, "only bob's untouched balance remains");
    }

    /// forge-config: default.fuzz.runs = 256
    function testFuzz_ExactPriceIsChargedWhateverTheSurplus(uint256 extraBalance, uint256 extraAllowance) public {
        extraBalance = bound(extraBalance, 0, 1e30);
        extraAllowance = bound(extraAllowance, 0, type(uint256).max - GENESIS_PRICE);
        bmc.mint(alice, GENESIS_PRICE + extraBalance);
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE + extraAllowance);
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(bmc.balanceOf(alice), extraBalance);
        // Infinite approvals are not decremented by ERC20; anything else is reduced by exactly the price.
        uint256 expectedAllowance =
            GENESIS_PRICE + extraAllowance == type(uint256).max ? type(uint256).max : extraAllowance;
        assertEq(bmc.allowance(alice, address(pass)), expectedAllowance);
        assertEq(pass.totalBurned(), GENESIS_PRICE);
    }

    // ------------------------------------------------------------------ receivers and re-entry

    function test_MintToRejectingReceiverRollsBackTheBurn() public {
        RejectingReceiver rejecting = new RejectingReceiver();
        NoHookReceiver plain = new NoHookReceiver();
        address[2] memory minters = [address(rejecting), address(plain)];
        for (uint256 i; i < 2; ++i) {
            bmc.mint(minters[i], GENESIS_PRICE);
            vm.startPrank(minters[i]);
            bmc.approve(address(pass), GENESIS_PRICE);
            vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, minters[i]));
            pass.mintGenesis();
            vm.stopPrank();
            assertEq(bmc.balanceOf(minters[i]), GENESIS_PRICE, "burn rolled back");
        }
        assertEq(pass.totalMinted(), 0);
        assertEq(pass.totalBurned(), 0);
        assertEq(bmc.totalSupply(), 2 * GENESIS_PRICE);
    }

    function test_RevealInsideMintCallbackCannotSettleTheNewToken() public {
        _finishPhase1();
        uint256 earlier = _mintMysteryAs(alice);
        vm.roll(block.number + 2);
        RevealingReceiver r = new RevealingReceiver(pass);
        bmc.mint(address(r), MYSTERY_PRICE);
        vm.startPrank(address(r));
        bmc.approve(address(pass), MYSTERY_PRICE);
        uint256 id = pass.mintMystery();
        vm.stopPrank();
        // reveal() is not reentrancy-guarded: the callback may settle finalized earlier tokens...
        assertEq(r.revealedInCallback(), 1);
        assertTrue(pass.tierOf(earlier) != BMCIlluminatiPass.Tier.Pending);
        // ...but the token being minted has no finalized reveal block and stays pending.
        assertEq(r.tierSeenInCallback(), uint8(BMCIlluminatiPass.Tier.Pending));
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Pending));
        assertEq(pass.ownerOf(id), address(r));
        assertEq(pass.totalMinted(), 42);
        assertEq(pass.revealedCount(), 1);
        assertEq(pass.pendingReveals(), 1);
    }

    function test_PendingTokenTransferKeepsItsRevealSchedule() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = pass.revealBlockOf(id);
        vm.prank(alice);
        pass.transferFrom(alice, bob, id);
        assertEq(pass.revealBlockOf(id), revealBlock);
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Pending));
        vm.roll(revealBlock + 1);
        assertEq(pass.reveal(1), 1);
        assertEq(pass.ownerOf(id), bob);
        assertTrue(pass.tierOf(id) != BMCIlluminatiPass.Tier.Pending);
    }

    // ------------------------------------------------------------------ views at the boundaries

    function test_ViewsAtThePhaseBoundary() public {
        _finishPhase1();
        assertEq(pass.revealBlockOf(40), 0);
        assertEq(pass.revealDeadlineOf(40), 0);
        assertEq(pass.remainingMysteryMints(), 460);
        assertEq(pass.currentPrice(), MYSTERY_PRICE);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 41));
        pass.revealBlockOf(41);
        uint256 id = _mintMysteryAs(alice);
        assertEq(id, 41);
        assertEq(pass.revealBlockOf(41), block.number + 1);
        assertEq(pass.revealDeadlineOf(41), block.number + 1 + 8191);
        assertEq(pass.remainingMysteryMints(), 459);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 42));
        pass.revealStatusOf(42);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, type(uint256).max));
        pass.tokenURI(type(uint256).max);
    }

    function test_StandardSVGRevertsForGenesisAndPendingTokens() public {
        _finishPhase1();
        vm.expectRevert(bytes("not standard"));
        pass.standardSVG(1);
        vm.expectRevert(bytes("not standard"));
        pass.standardSVG(40);
        uint256 id = _mintMysteryAs(alice);
        vm.expectRevert(bytes("not standard"));
        pass.standardSVG(id);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 0));
        pass.standardSVG(0);
    }

    function test_GenesisFileNamesAreZeroPaddedForAllForty() public {
        _finishPhase1();
        for (uint256 id = 1; id <= 40; ++id) {
            string memory json = _decodeTokenURI(id);
            string memory expected =
                string.concat("/genesis-", id < 10 ? "0" : "", vm.toString(id), '.png","attributes"');
            assertTrue(_contains(json, expected), string.concat("filename for token ", vm.toString(id)));
            assertFalse(_contains(json, "genesis-0.png"));
        }
    }

    function test_MysteryGenesisFileNameMatchesArtwork41To77() public {
        _finishPhase1();
        // Drive hashes until a Genesis outcome appears (at most a few dozen draws are needed).
        for (uint256 i; i < 60; ++i) {
            uint256 id = _mintMysteryAs(alice);
            vm.roll(block.number + 2);
            vm.setBlockhash(block.number - 1, keccak256(abi.encode("search", i)));
            pass.reveal(1);
            if (pass.tierOf(id) == BMCIlluminatiPass.Tier.Genesis) {
                uint16 art = pass.artworkIdOf(id);
                assertTrue(art >= 41 && art <= 77);
                string memory json = _decodeTokenURI(id);
                assertTrue(_contains(json, string.concat("/genesis-", vm.toString(uint256(art)), ".png")));
                assertTrue(_contains(json, '{"trait_type":"Tier","value":"Genesis"}'));
                assertFalse(_contains(json, "Legendary"));
                assertTrue(
                    _contains(
                        json,
                        string.concat('"Genesis Number","display_type":"number","value":', vm.toString(uint256(art)))
                    )
                );
                return;
            }
        }
        revert("no Genesis outcome in 60 draws");
    }

    // ------------------------------------------------------------------ launch gate edges

    function test_OpenMintingOnRehearsalChainIsAlreadyOpenForOwnerAndUnauthorizedForOthers() public {
        vm.prank(owner);
        vm.expectRevert(BMCIlluminatiPass.MintingAlreadyOpen.selector);
        pass.openMinting();
        vm.prank(alice);
        vm.expectRevert();
        pass.openMinting();
        assertTrue(pass.mintingOpen());
    }

    function test_MainnetGateBlocksRevealOfNothingButNotViews() public {
        vm.chainId(1);
        BMCIlluminatiPass gated = new BMCIlluminatiPass(owner, address(bmc));
        assertEq(gated.reveal(10), 0, "reveal is harmless while closed");
        assertEq(gated.currentPrice(), GENESIS_PRICE);
        assertEq(gated.remainingSupply(), 500);
        assertTrue(gated.genesisPhaseActive());
        bmc.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(gated), GENESIS_PRICE);
        vm.expectRevert(BMCIlluminatiPass.MintingNotOpen.selector);
        gated.mintGenesis();
        vm.stopPrank();
        assertEq(bmc.allowance(alice, address(gated)), GENESIS_PRICE, "closed gate spends nothing");
    }

    function test_OwnershipTransferDoesNotTouchTheGateOrMints() public {
        vm.chainId(1);
        BMCIlluminatiPass gated = new BMCIlluminatiPass(owner, address(bmc));
        vm.prank(owner);
        gated.transferOwnership(bob);
        vm.prank(owner);
        vm.expectRevert();
        gated.openMinting();
        vm.prank(bob);
        gated.openMinting();
        assertTrue(gated.mintingOpen());
        bmc.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(gated), GENESIS_PRICE);
        assertEq(gated.mintGenesis(), 1);
        vm.stopPrank();
        assertEq(gated.owner(), bob);
        assertEq(gated.balanceOf(bob), 0, "new owner receives no token");
    }
}
