// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BMCIlluminatiPass} from "../src/BMCIlluminatiPass.sol";
import {StandardArt} from "../src/StandardArt.sol";
import {MockBMC, FakeBurnBMC, SixDecimalBMC} from "./mocks/MockBMC.sol";
import {DeployBMCIlluminatiPass} from "../script/Deploy.s.sol";

/// @dev Minimal EIP-2935 history contract stand-in: 32-byte block number in, stored hash out.
contract MockBlockHistory {
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

/// @dev Throwaway minter used by the selective-caller regression: reverts unless its mint is Genesis.
contract Picker is IERC721Receiver {
    BMCIlluminatiPass immutable pass;
    MockBMC immutable bmc;
    address immutable parent;

    constructor(BMCIlluminatiPass p, MockBMC t) {
        pass = p;
        bmc = t;
        parent = msg.sender;
    }

    function tryGenesis(uint256 price) external returns (uint256 id) {
        bmc.transferFrom(parent, address(this), price);
        bmc.approve(address(pass), price);
        id = pass.mintMystery();
        require(pass.tierOf(id) == BMCIlluminatiPass.Tier.Genesis, "not genesis: roll back");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract Hunter {
    BMCIlluminatiPass immutable pass;
    MockBMC immutable bmc;

    constructor(BMCIlluminatiPass p, MockBMC t) {
        pass = p;
        bmc = t;
    }

    function hunt(uint256 price, uint256 maxTries) external returns (uint256 id, uint256 tries) {
        for (tries = 1; tries <= maxTries; tries++) {
            Picker p = new Picker(pass, bmc);
            bmc.approve(address(p), price);
            try p.tryGenesis(price) returns (uint256 got) {
                return (got, tries);
            } catch {}
        }
        return (0, tries - 1);
    }
}

contract Reenterer is IERC721Receiver {
    BMCIlluminatiPass public pass;
    bool public attackGenesis;
    uint256 public attempts;
    bytes public lastRevert;

    constructor(BMCIlluminatiPass p) {
        pass = p;
    }

    function setAttackGenesis(bool v) external {
        attackGenesis = v;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        attempts++;
        if (attackGenesis) {
            try pass.mintGenesis() {}
            catch (bytes memory reason) {
                lastRevert = reason;
                revert("reentered");
            }
        } else {
            try pass.mintMystery() {}
            catch (bytes memory reason) {
                lastRevert = reason;
                revert("reentered");
            }
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract BMCIlluminatiPassTest is Test {
    MockBMC bmc;
    BMCIlluminatiPass pass;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant GENESIS_PRICE = 1_000_000e18;
    uint256 constant MYSTERY_PRICE = 350_000e18;

    function setUp() public {
        bmc = new MockBMC();
        pass = new BMCIlluminatiPass(owner, address(bmc));
    }

    // ------------------------------------------------------------------ helpers

    function _fund(address who, uint256 amount) internal {
        bmc.mint(who, amount);
    }

    function _mintGenesisAs(address who) internal returns (uint256 id) {
        _fund(who, GENESIS_PRICE);
        vm.startPrank(who);
        bmc.approve(address(pass), GENESIS_PRICE);
        id = pass.mintGenesis();
        vm.stopPrank();
    }

    function _mintMysteryAs(address who) internal returns (uint256 id) {
        _fund(who, MYSTERY_PRICE);
        vm.startPrank(who);
        bmc.approve(address(pass), MYSTERY_PRICE);
        id = pass.mintMystery();
        vm.stopPrank();
    }

    /// @dev Finalize the reveal block and settle every pending mystery token.
    function _revealAll() internal returns (uint256 n) {
        vm.roll(block.number + 2);
        n = pass.reveal(500);
    }

    function _mintAndReveal(address who) internal returns (uint256 id) {
        id = _mintMysteryAs(who);
        _revealAll();
    }

    function _finishPhase1() internal {
        for (uint256 i = 0; i < 40; i++) {
            _mintGenesisAs(address(uint160(0x1000 + i)));
        }
        assertEq(pass.totalMinted(), 40);
    }

    function _decodeTokenURI(uint256 id) internal view returns (string memory) {
        string memory uri = pass.tokenURI(id);
        bytes memory b = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory payload = new bytes(b.length - prefix.length);
        for (uint256 i = 0; i < payload.length; i++) {
            payload[i] = b[i + prefix.length];
        }
        return string(_b64decode(payload));
    }

    function _b64decode(bytes memory data) internal pure returns (bytes memory out) {
        bytes memory table = bytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
        uint8[256] memory rev;
        for (uint8 i = 0; i < 64; i++) {
            rev[uint8(table[i])] = i;
        }
        uint256 len = data.length;
        uint256 pad;
        if (len > 0 && data[len - 1] == "=") pad++;
        if (len > 1 && data[len - 2] == "=") pad++;
        out = new bytes((len / 4) * 3 - pad);
        uint256 o;
        for (uint256 i = 0; i < len; i += 4) {
            uint256 n = (uint256(rev[uint8(data[i])]) << 18) | (uint256(rev[uint8(data[i + 1])]) << 12)
                | (uint256(rev[uint8(data[i + 2])]) << 6) | uint256(rev[uint8(data[i + 3])]);
            if (o < out.length) out[o++] = bytes1(uint8(n >> 16));
            if (o < out.length) out[o++] = bytes1(uint8(n >> 8));
            if (o < out.length) out[o++] = bytes1(uint8(n));
        }
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i = 0; i + n.length <= h.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ deployment / config

    function test_DeployScriptConfig() public {
        DeployBMCIlluminatiPass d = new DeployBMCIlluminatiPass();
        DeployBMCIlluminatiPass.Config memory cfg = d.mainnetConfig(owner);
        assertEq(cfg.bmc, 0x38224239f2BDae357D47cb864BC533d7f72dF961);
        BMCIlluminatiPass p = d.deploy(cfg);
        assertEq(p.owner(), owner);
        assertEq(address(p.BMC()), cfg.bmc);
        assertEq(p.name(), "BMC Illuminati Pass");
        assertEq(p.symbol(), "BMCPASS");
        assertEq(p.genesisImagesCID(), "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u");
        // Deployment succeeds without token code. First use validates that dependency.
        assertTrue(p.mintingOpen(), "rehearsal chain is open from construction");
        vm.expectRevert(BMCIlluminatiPass.BMCTokenUnavailable.selector);
        p.mintGenesis();
    }

    function test_DeployScriptRequiresOwner() public {
        DeployBMCIlluminatiPass d = new DeployBMCIlluminatiPass();
        DeployBMCIlluminatiPass.Config memory cfg = d.mainnetConfig(address(0));
        vm.expectRevert(bytes("owner required"));
        d.deploy(cfg);
    }

    function test_Constants() public view {
        assertEq(pass.MAX_SUPPLY(), 500);
        assertEq(pass.GENESIS_PHASE_SUPPLY(), 40);
        assertEq(pass.MYSTERY_SUPPLY(), 460);
        assertEq(pass.TOTAL_GENESIS(), 77);
        assertEq(pass.MYSTERY_GENESIS(), 37);
        assertEq(pass.TOTAL_STANDARD(), 423);
        assertEq(pass.GENESIS_PRICE(), GENESIS_PRICE);
        assertEq(pass.MYSTERY_PRICE(), MYSTERY_PRICE);
        assertEq(pass.MAX_TOTAL_BURN(), 201_000_000e18);
        assertEq(40 * GENESIS_PRICE + 460 * MYSTERY_PRICE, pass.MAX_TOTAL_BURN());
        assertEq(pass.REVEAL_WINDOW(), 8191);
        assertEq(pass.BLOCK_HISTORY(), 0x0000F90827F1C53a10cb7A02335B175320002935);
    }

    // ------------------------------------------------------------------ launch gate

    function _mainnetPass() internal returns (BMCIlluminatiPass p) {
        vm.chainId(1);
        p = new BMCIlluminatiPass(owner, address(bmc));
    }

    function test_LaunchGate_MainnetDeploymentIsClosedUntilOwnerOpens() public {
        BMCIlluminatiPass p = _mainnetPass();
        assertFalse(p.mintingOpen());
        _fund(alice, GENESIS_PRICE + MYSTERY_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(p), GENESIS_PRICE + MYSTERY_PRICE);
        vm.expectRevert(BMCIlluminatiPass.MintingNotOpen.selector);
        p.mintGenesis();
        vm.expectRevert(BMCIlluminatiPass.MintingNotOpen.selector);
        p.mintMystery();
        vm.stopPrank();
        assertEq(p.totalMinted(), 0);
        assertEq(bmc.balanceOf(alice), GENESIS_PRICE + MYSTERY_PRICE, "nothing burned while closed");

        vm.prank(owner);
        p.openMinting();
        assertTrue(p.mintingOpen());
        vm.prank(alice);
        assertEq(p.mintGenesis(), 1);
        assertEq(uint8(p.tierOf(1)), uint8(BMCIlluminatiPass.Tier.LegendaryGenesis));
    }

    function test_LaunchGate_OnlyOwnerOpensAndNothingCanCloseAgain() public {
        BMCIlluminatiPass p = _mainnetPass();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        p.openMinting();
        vm.startPrank(owner);
        p.openMinting();
        vm.expectRevert(BMCIlluminatiPass.MintingAlreadyOpen.selector);
        p.openMinting();
        (bool pause,) = address(p).call(abi.encodeWithSignature("pause()"));
        (bool close,) = address(p).call(abi.encodeWithSignature("closeMinting()"));
        (bool set,) = address(p).call(abi.encodeWithSignature("setMintActive(bool)", false));
        p.renounceOwnership();
        vm.stopPrank();
        assertFalse(pause);
        assertFalse(close);
        assertFalse(set);
        assertTrue(p.mintingOpen(), "open survives ownership renunciation");
        _fund(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(p), GENESIS_PRICE);
        assertEq(p.mintGenesis(), 1);
        vm.stopPrank();
    }

    function test_LaunchGate_RehearsalChainIsOpenFromConstruction() public view {
        assertTrue(block.chainid != 1);
        assertTrue(pass.mintingOpen());
    }

    // ------------------------------------------------------------------ phase 1

    function test_FirstMinterGetsLegendaryGenesis1() public {
        uint256 id = _mintGenesisAs(alice);
        assertEq(id, 1);
        assertEq(pass.ownerOf(1), alice);
        assertEq(uint8(pass.tierOf(1)), uint8(BMCIlluminatiPass.Tier.LegendaryGenesis));
        assertEq(pass.artworkIdOf(1), 1);
        string memory json = _decodeTokenURI(1);
        assertTrue(_contains(json, '"Legendary Genesis"'));
        assertTrue(_contains(json, "ipfs://bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u/genesis-01.png"));
        assertTrue(_contains(json, "Legendary Golden Crown"));
    }

    function test_Mints2To40AreSequentialGenesis() public {
        _mintGenesisAs(alice);
        for (uint256 i = 2; i <= 40; i++) {
            address who = address(uint160(0x3000 + i));
            uint256 id = _mintGenesisAs(who);
            assertEq(id, i);
            assertEq(pass.ownerOf(i), who);
            assertEq(uint8(pass.tierOf(i)), uint8(BMCIlluminatiPass.Tier.Genesis));
            assertEq(pass.artworkIdOf(i), uint16(i));
        }
        string memory json = _decodeTokenURI(7);
        assertTrue(_contains(json, "/genesis-07.png"));
        assertTrue(_contains(json, '{"trait_type":"Tier","value":"Genesis"}'));
        assertFalse(_contains(json, "Legendary"));
        json = _decodeTokenURI(40);
        assertTrue(_contains(json, "/genesis-40.png"));
        assertEq(pass.totalMinted(), 40);
        assertFalse(pass.genesisPhaseActive());
        assertEq(pass.totalBurned(), 40 * GENESIS_PRICE);
    }

    function test_Phase1CostsExactlyOneMillion() public {
        _fund(alice, 5_000_000e18);
        uint256 supplyBefore = bmc.totalSupply();
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE);
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(bmc.balanceOf(alice), 4_000_000e18);
        assertEq(bmc.totalSupply(), supplyBefore - GENESIS_PRICE, "tokens destroyed, not moved");
        assertEq(bmc.balanceOf(address(pass)), 0);
        assertEq(bmc.allowance(alice, address(pass)), 0);
        assertEq(pass.totalBurned(), GENESIS_PRICE);
        assertEq(pass.currentPrice(), GENESIS_PRICE);
    }

    function test_GenesisRevertsAfterPhase1() public {
        _finishPhase1();
        _fund(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE);
        vm.expectRevert(BMCIlluminatiPass.GenesisPhaseOver.selector);
        pass.mintGenesis();
        vm.stopPrank();
    }

    function test_MysteryRevertsDuringPhase1() public {
        _mintGenesisAs(alice);
        _fund(bob, MYSTERY_PRICE);
        vm.startPrank(bob);
        bmc.approve(address(pass), MYSTERY_PRICE);
        vm.expectRevert(BMCIlluminatiPass.GenesisPhaseNotOver.selector);
        pass.mintMystery();
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ burn / allowance failures

    function test_RevertNoAllowance() public {
        _fund(alice, GENESIS_PRICE);
        vm.prank(alice);
        vm.expectRevert();
        pass.mintGenesis();
        assertEq(pass.totalMinted(), 0);
        assertEq(bmc.balanceOf(alice), GENESIS_PRICE);
    }

    function test_RevertInsufficientAllowance() public {
        _fund(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE - 1);
        vm.expectRevert();
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(pass.totalMinted(), 0);
    }

    function test_RevertInsufficientBalance() public {
        _fund(alice, GENESIS_PRICE - 1);
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE);
        vm.expectRevert();
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(pass.totalMinted(), 0);
        assertEq(pass.totalBurned(), 0);
    }

    function test_ExcessAllowanceOnlyBurnsPrice() public {
        _fund(alice, 10_000_000e18);
        vm.startPrank(alice);
        bmc.approve(address(pass), 10_000_000e18);
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(bmc.balanceOf(alice), 9_000_000e18);
        assertEq(bmc.allowance(alice, address(pass)), 9_000_000e18);
    }

    function test_RevertWhenTokenDoesNotActuallyBurn() public {
        FakeBurnBMC fake = new FakeBurnBMC();
        BMCIlluminatiPass p = new BMCIlluminatiPass(owner, address(fake));
        fake.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        fake.approve(address(p), GENESIS_PRICE);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.BurnMismatch.selector, GENESIS_PRICE, 0));
        p.mintGenesis();
        vm.stopPrank();
    }

    function test_RevertWhenTokenDecimalsUnexpected() public {
        SixDecimalBMC six = new SixDecimalBMC();
        BMCIlluminatiPass p = new BMCIlluminatiPass(owner, address(six));
        six.mint(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        six.approve(address(p), GENESIS_PRICE);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.UnexpectedTokenDecimals.selector, uint8(6)));
        p.mintGenesis();
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ reentrancy

    function test_ReentrancyGenesisBlocked() public {
        Reenterer r = new Reenterer(pass);
        r.setAttackGenesis(true);
        _fund(address(r), 2 * GENESIS_PRICE);
        vm.prank(address(r));
        bmc.approve(address(pass), 2 * GENESIS_PRICE);
        vm.prank(address(r));
        vm.expectRevert(bytes("reentered"));
        pass.mintGenesis();
        assertEq(pass.totalMinted(), 0);
        assertEq(pass.totalBurned(), 0);
        assertEq(bmc.balanceOf(address(r)), 2 * GENESIS_PRICE);
    }

    function test_ReentrancyMysteryBlocked() public {
        _finishPhase1();
        Reenterer r = new Reenterer(pass);
        r.setAttackGenesis(false);
        _fund(address(r), 2 * MYSTERY_PRICE);
        vm.prank(address(r));
        bmc.approve(address(pass), 2 * MYSTERY_PRICE);
        vm.prank(address(r));
        vm.expectRevert(bytes("reentered"));
        pass.mintMystery();
        assertEq(pass.totalMinted(), 40);
        assertEq(bmc.balanceOf(address(r)), 2 * MYSTERY_PRICE);
        // The receiver only reverts with "reentered" when its inner mint call failed; a successful
        // reentrant mint would have let the outer mint succeed and the expectRevert above fail.
        assertEq(r.attempts(), 0, "outer revert rolled back the receiver state too");
    }

    // ------------------------------------------------------------------ phase 2

    function test_Phase2CostsExactly350k() public {
        _finishPhase1();
        _fund(alice, 1_000_000e18);
        uint256 supplyBefore = bmc.totalSupply();
        vm.startPrank(alice);
        bmc.approve(address(pass), MYSTERY_PRICE);
        uint256 id = pass.mintMystery();
        vm.stopPrank();
        assertEq(id, 41);
        assertEq(pass.ownerOf(41), alice);
        assertEq(bmc.balanceOf(alice), 650_000e18);
        assertEq(bmc.totalSupply(), supplyBefore - MYSTERY_PRICE);
        assertEq(pass.totalBurned(), 40 * GENESIS_PRICE + MYSTERY_PRICE);
        // Burn is final; the outcome is not: nothing in the mint transaction can see it.
        assertEq(uint8(pass.tierOf(41)), uint8(BMCIlluminatiPass.Tier.Pending));
        assertEq(pass.artworkIdOf(41), 0);
        assertEq(uint8(pass.revealStatusOf(41)), uint8(BMCIlluminatiPass.RevealStatus.AwaitingRandomness));
        assertEq(pass.revealBlockOf(41), block.number + 1);
        assertEq(pass.revealDeadlineOf(41), block.number + 1 + 8191);
        assertEq(pass.pendingReveals(), 1);
        assertEq(pass.nextRevealId(), 41);
        assertEq(pass.remainingMysteryMints(), 459);
        assertEq(pass.remainingMysteryGenesis(), 37);
        assertEq(pass.currentPrice(), MYSTERY_PRICE);
        assertEq(_revealAll(), 1);
        assertTrue(pass.tierOf(41) != BMCIlluminatiPass.Tier.Pending);
        assertEq(uint8(pass.revealStatusOf(41)), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.nextRevealId(), 0);
    }

    // ------------------------------------------------------------------ commit-reveal

    /// Finding cfb1eeea: a selective contract caller cannot pick a Genesis outcome inside the mint.
    function test_SelectiveCallerCannotChooseMysteryOutcome() public {
        _finishPhase1();
        Hunter hunter = new Hunter(pass, bmc);
        _fund(address(hunter), MYSTERY_PRICE);
        (uint256 id, uint256 tries) = hunter.hunt(MYSTERY_PRICE, 300);
        assertEq(id, 0, "no attempt could confirm a Genesis inside its own transaction");
        assertEq(tries, 300);
        assertEq(pass.mysteryGenesisRevealed(), 0);
        // Every attempt saw Tier.Pending and reverted, rolling back its own burn: no free re-rolls, no mint.
        assertEq(pass.totalMinted(), 40);
        assertEq(bmc.balanceOf(address(hunter)), MYSTERY_PRICE);
    }

    function test_RevealWaitsForTheBlockAfterTheMint() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        assertEq(pass.reveal(10), 0, "same block: nothing to settle");
        vm.roll(block.number + 1);
        assertEq(pass.reveal(10), 0, "reveal block still open: nothing to settle");
        assertEq(uint8(pass.revealStatusOf(id)), uint8(BMCIlluminatiPass.RevealStatus.AwaitingRandomness));
        vm.roll(block.number + 1);
        assertEq(uint8(pass.revealStatusOf(id)), uint8(BMCIlluminatiPass.RevealStatus.RandomnessStored));
        vm.prank(bob); // anyone may settle
        assertEq(pass.reveal(10), 1);
        assertTrue(pass.tierOf(id) != BMCIlluminatiPass.Tier.Pending);
        assertEq(pass.reveal(10), 0);
    }

    function test_RevealOutcomeDependsOnlyOnTheRevealBlockHash() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = block.number + 1;
        vm.roll(revealBlock + 1);
        vm.setBlockhash(revealBlock, keccak256("reveal block"));
        uint256 snap = vm.snapshotState();
        pass.reveal(1);
        bytes32 early = keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id)));
        vm.revertToState(snap);
        vm.roll(revealBlock + 200);
        vm.warp(block.timestamp + 1 days);
        vm.prevrandao(bytes32(uint256(12345)));
        vm.prank(bob);
        pass.reveal(1);
        assertEq(keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id))), early, "timing/caller cannot change it");
    }

    function test_RevealIsInMintOrderAndBatched() public {
        _finishPhase1();
        uint256 a = _mintMysteryAs(alice);
        vm.roll(block.number + 1);
        uint256 b = _mintMysteryAs(bob);
        vm.roll(block.number + 1); // a's reveal block is final, b's is the current block
        assertEq(pass.reveal(10), 1);
        assertTrue(pass.tierOf(a) != BMCIlluminatiPass.Tier.Pending);
        assertEq(uint8(pass.tierOf(b)), uint8(BMCIlluminatiPass.Tier.Pending));
        uint256 c = _mintMysteryAs(alice);
        vm.roll(block.number + 2);
        assertEq(pass.reveal(1), 1, "maxCount bounds the batch");
        assertTrue(pass.tierOf(b) != BMCIlluminatiPass.Tier.Pending);
        assertEq(uint8(pass.tierOf(c)), uint8(BMCIlluminatiPass.Tier.Pending));
        assertEq(pass.pendingReveals(), 1);
        assertEq(pass.nextRevealId(), c);
        assertEq(pass.reveal(1), 1);
        assertEq(pass.pendingReveals(), 0);
    }

    function test_ExpiredRevealWindowSettlesAsStandard() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        vm.roll(block.number + 1 + 8191 + 1); // one block past the deadline, no history contract
        assertTrue(block.number > pass.revealDeadlineOf(id));
        vm.expectEmit(true, false, false, false);
        emit BMCIlluminatiPass.Revealed(id, BMCIlluminatiPass.Tier.Standard, 0, true);
        assertEq(pass.reveal(1), 1);
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Standard));
        assertEq(pass.mysteryGenesisRevealed(), 0);
        assertEq(pass.remainingMysteryGenesis(), 37);
        assertEq(pass.remainingMysteryStandard(), 422);
        uint16 art = pass.artworkIdOf(id);
        assertTrue(art >= 1 && art <= 423);
    }

    function test_ExpiredWindowWithOnlyGenesisLeftStillSettles() public {
        _finishPhase1();
        for (uint256 i; i < 460; ++i) {
            _mintMysteryAs(alice);
        }
        vm.roll(block.number + 1 + 8191 + 1); // every token's window expired
        // Forced settlement takes Standard slots first: 423 forced reveals exhaust them, Genesis untouched.
        assertEq(pass.reveal(423), 423);
        assertEq(pass.remainingMysteryStandard(), 0);
        assertEq(pass.remainingMysteryGenesis(), 37);
        assertEq(pass.mysteryGenesisRevealed(), 0);
        for (uint256 id = 41; id <= 463; ++id) {
            assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Standard));
        }
        // Only Genesis slots remain: the fallback still settles every remaining token.
        assertEq(pass.reveal(100), 37);
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.mysteryGenesisRevealed(), 37);
        for (uint256 id = 464; id <= 500; ++id) {
            assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Genesis));
            assertTrue(pass.artworkIdOf(id) >= 41 && pass.artworkIdOf(id) <= 77);
        }
    }

    function test_HistoryContractExtendsRevealWindowBeyond256Blocks() public {
        _finishPhase1();
        MockBlockHistory impl = new MockBlockHistory();
        vm.etch(pass.BLOCK_HISTORY(), address(impl).code);
        MockBlockHistory history = MockBlockHistory(pass.BLOCK_HISTORY());
        uint256 id = _mintMysteryAs(alice);
        uint256 revealBlock = block.number + 1;
        bytes32 hash = keccak256("the reveal block");
        vm.roll(revealBlock + 100); // native blockhash path
        vm.setBlockhash(revealBlock, hash);
        history.set(revealBlock, hash);
        uint256 snap = vm.snapshotState();
        pass.reveal(1);
        bytes32 native = keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id)));
        vm.revertToState(snap);
        vm.roll(revealBlock + 5000); // beyond 256: EIP-2935 path
        assertEq(blockhash(revealBlock), bytes32(0));
        pass.reveal(1);
        assertEq(keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id))), native, "same hash, same outcome");
        vm.revertToState(snap);
        vm.roll(revealBlock + 8192); // past the window even with history: forced Standard
        pass.reveal(1);
        assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Standard));
    }

    function test_PendingMetadataIsNeutralAndFinalMetadataIsPermanent() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        string memory json = _decodeTokenURI(id);
        assertTrue(_contains(json, '"Tier","value":"Unrevealed"'));
        assertTrue(_contains(json, "Unrevealed"));
        assertFalse(_contains(json, "genesis-"));
        assertFalse(_contains(json, '"value":"Standard"'));
        assertTrue(_contains(json, '"image":"data:image/svg+xml;base64,'));
        _revealAll();
        bytes32 finalMetadata = keccak256(bytes(pass.tokenURI(id)));
        assertFalse(_contains(_decodeTokenURI(id), "Unrevealed"));
        vm.roll(block.number + 10_000);
        assertEq(keccak256(bytes(pass.tokenURI(id))), finalMetadata);
    }

    function test_RevertingRevealCallerCannotReroll() public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        vm.roll(block.number + 2);
        uint256 snap = vm.snapshotState();
        pass.reveal(1);
        bytes32 outcome = keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id)));
        vm.revertToState(snap);
        // A reverted reveal (simulated by the snapshot) changes nothing: the next reveal is identical.
        vm.roll(block.number + 50);
        pass.reveal(1);
        assertEq(keccak256(abi.encode(pass.tierOf(id), pass.artworkIdOf(id))), outcome);
    }

    function test_TransfersAreStandard() public {
        _mintGenesisAs(alice);
        vm.prank(alice);
        pass.transferFrom(alice, bob, 1);
        assertEq(pass.ownerOf(1), bob);
        assertEq(bmc.totalSupply(), 0, "no BMC burned on transfer");
        assertEq(pass.totalBurned(), GENESIS_PRICE);
        vm.prank(bob);
        pass.safeTransferFrom(bob, alice, 1);
        assertEq(pass.ownerOf(1), alice);
    }

    function test_ViewsRevertForNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 0));
        pass.tierOf(0);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 1));
        pass.tokenURI(1);
        vm.expectRevert(abi.encodeWithSelector(BMCIlluminatiPass.NonexistentToken.selector, 501));
        pass.artworkIdOf(501);
    }

    // ------------------------------------------------------------------ full mint-out

    function test_Full500MintSimulation() public {
        _finishPhase1();
        for (uint256 i = 0; i < 460; i++) {
            address who = address(uint160(0x5000 + (i % 97)));
            uint256 id = _mintMysteryAs(who);
            assertEq(id, 41 + i);
            assertEq(uint8(pass.tierOf(id)), uint8(BMCIlluminatiPass.Tier.Pending));
            vm.roll(block.number + 2);
            vm.setBlockhash(block.number - 1, keccak256(abi.encode("entropy", i)));
            assertEq(pass.reveal(1), 1);
            assertTrue(pass.tierOf(id) != BMCIlluminatiPass.Tier.Pending);
        }
        assertEq(pass.totalMinted(), 500);
        assertEq(pass.remainingSupply(), 0);
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.currentPrice(), 0);

        // Sold out: no further mints of either kind.
        _fund(alice, GENESIS_PRICE);
        vm.startPrank(alice);
        bmc.approve(address(pass), GENESIS_PRICE);
        vm.expectRevert(BMCIlluminatiPass.SoldOut.selector);
        pass.mintMystery();
        vm.expectRevert(BMCIlluminatiPass.GenesisPhaseOver.selector);
        pass.mintGenesis();
        vm.stopPrank();

        assertEq(pass.revealedCount(), 460);
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.remainingMysteryGenesis(), 0);
        assertEq(pass.remainingMysteryStandard(), 0);

        // Tally: 77 Genesis, 423 Standard, no duplicate artwork, no tier inferable from id.
        uint256 genesis;
        uint256 standard;
        bool[78] memory genesisSeen;
        bool[424] memory standardSeen;
        for (uint256 id = 1; id <= 500; id++) {
            BMCIlluminatiPass.Tier t = pass.tierOf(id);
            uint16 art = pass.artworkIdOf(id);
            if (t == BMCIlluminatiPass.Tier.LegendaryGenesis) {
                assertEq(id, 1);
                assertEq(art, 1);
                genesis++;
                genesisSeen[1] = true;
            } else if (t == BMCIlluminatiPass.Tier.Genesis) {
                assertTrue(art >= 2 && art <= 77, "genesis art range");
                assertFalse(genesisSeen[art], "duplicate genesis artwork");
                genesisSeen[art] = true;
                genesis++;
                if (id <= 40) assertEq(art, id);
                else assertTrue(art >= 41);
            } else if (t == BMCIlluminatiPass.Tier.Standard) {
                assertTrue(id > 40);
                assertTrue(art >= 1 && art <= 423, "standard art range");
                assertFalse(standardSeen[art], "duplicate standard artwork");
                standardSeen[art] = true;
                standard++;
            } else {
                revert("pending token after full reveal");
            }
        }
        assertEq(genesis, 77);
        assertEq(standard, 423);
        for (uint256 g = 1; g <= 77; g++) {
            assertTrue(genesisSeen[g], "genesis artwork never assigned");
        }
        for (uint256 s = 1; s <= 423; s++) {
            assertTrue(standardSeen[s], "standard artwork never assigned");
        }
        assertEq(pass.mysteryGenesisRevealed(), 37);
        assertEq(pass.totalBurned(), 201_000_000e18);
        assertEq(pass.totalBurned(), pass.MAX_TOTAL_BURN());
        // Only the unspent sold-out probe balance remains: every BMC paid for a mint was destroyed.
        assertEq(bmc.totalSupply(), GENESIS_PRICE, "every BMC paid was destroyed");
    }

    function test_FullMintOutInSameBlockThenBatchReveal() public {
        _finishPhase1();
        for (uint256 i = 0; i < 460; i++) {
            _mintMysteryAs(alice);
        }
        assertEq(pass.pendingReveals(), 460);
        vm.roll(block.number + 2);
        assertEq(pass.reveal(100), 100);
        assertEq(pass.pendingReveals(), 360);
        assertEq(pass.reveal(1000), 360);
        assertEq(pass.revealedCount(), 460);
        assertEq(pass.mysteryGenesisRevealed(), 37);
        assertEq(pass.remainingMysteryStandard(), 0);
        assertEq(pass.totalBurned(), 201_000_000e18);
    }

    // ------------------------------------------------------------------ standard art

    function test_StandardArtCombinationsUnique() public pure {
        bool[5400] memory seen;
        for (uint256 i = 1; i <= 423; i++) {
            uint256 c = StandardArt.comboIndex(i);
            assertFalse(seen[c], "duplicate combination");
            seen[c] = true;
            StandardArt.Traits memory t = StandardArt.traitsOf(i);
            assertTrue(t.background < 6 && t.cloak < 5 && t.eyes < 6 && t.symbol < 5 && t.accessory < 6);
        }
    }

    function test_StandardArtCoversEveryTrait() public pure {
        bool[6] memory bg;
        bool[5] memory cl;
        bool[6] memory ey;
        bool[5] memory sy;
        bool[6] memory ac;
        for (uint256 i = 1; i <= 423; i++) {
            StandardArt.Traits memory t = StandardArt.traitsOf(i);
            bg[t.background] = true;
            cl[t.cloak] = true;
            ey[t.eyes] = true;
            sy[t.symbol] = true;
            ac[t.accessory] = true;
        }
        for (uint256 i = 0; i < 6; i++) {
            assertTrue(bg[i]);
            assertTrue(ey[i]);
            assertTrue(ac[i]);
        }
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(cl[i]);
            assertTrue(sy[i]);
        }
    }

    function test_StandardArtRendersWithoutGenesisTraits() public pure {
        for (uint256 i = 1; i <= 423; i += 47) {
            string memory svg = StandardArt.render(i);
            assertTrue(_contains(svg, "<svg"));
            assertTrue(_contains(svg, "</svg>"));
            assertFalse(_contains(svg, "#ffd700"));
            assertFalse(_contains(svg, "#d4af37"));
            assertFalse(_contains(svg, "gold"));
            assertFalse(_contains(svg, "triangle"));
        }
        string memory attrs = StandardArt.attributesJson(1);
        assertTrue(_contains(attrs, '"trait_type":"Background"'));
        assertFalse(_contains(attrs, "Third Eye"));
    }

    function test_StandardMetadataAfterReveal() public {
        _finishPhase1();
        // At most 37 Genesis outcomes: the first 38 draws must include a Standard.
        for (uint256 i = 0; i < 38; i++) {
            uint256 id = _mintAndReveal(alice);
            if (pass.tierOf(id) == BMCIlluminatiPass.Tier.Standard) {
                string memory json = _decodeTokenURI(id);
                uint16 art = pass.artworkIdOf(id);
                assertTrue(_contains(json, '{"trait_type":"Tier","value":"Standard"}'));
                assertTrue(_contains(json, string.concat('"value":"standard-', vm.toString(uint256(art)), '"')));
                assertTrue(_contains(json, '"trait_type":"Background"'));
                assertTrue(_contains(json, '"trait_type":"Accessory"'));
                assertFalse(_contains(json, "ipfs://"));
                string memory svg = pass.standardSVG(id);
                assertTrue(_contains(svg, "</svg>"));
                return;
            }
        }
        revert("no standard outcome in 38 draws");
    }

    function test_NoOwnerMintOrWithdrawSurface() public {
        // No special mint permission: even the owner must burn the full price.
        vm.startPrank(owner);
        vm.expectRevert();
        pass.mintGenesis(); // no allowance / balance: owner pays like anyone else
        vm.stopPrank();
        assertEq(pass.totalMinted(), 0);
    }

    function testFuzz_SingleRevealAlwaysInInventory(uint256 word) public {
        _finishPhase1();
        uint256 id = _mintMysteryAs(alice);
        vm.roll(block.number + 2);
        vm.setBlockhash(block.number - 1, bytes32(word));
        pass.reveal(1);
        BMCIlluminatiPass.Tier t = pass.tierOf(id);
        uint16 art = pass.artworkIdOf(id);
        if (t == BMCIlluminatiPass.Tier.Genesis) {
            assertTrue(art >= 41 && art <= 77);
            assertEq(pass.remainingMysteryGenesis(), 36);
            assertEq(pass.remainingMysteryStandard(), 423);
        } else {
            assertEq(uint8(t), uint8(BMCIlluminatiPass.Tier.Standard));
            assertTrue(art >= 1 && art <= 423);
            assertEq(pass.remainingMysteryGenesis(), 37);
            assertEq(pass.remainingMysteryStandard(), 422);
        }
    }

    // Audit regressions: constructor-complete metadata, no coordinator, no permanently stuck head token.
    function test_AuditElevenMysteryMintsRevealWithoutAnyExternalService() public {
        _finishPhase1();
        uint256 head = _mintMysteryAs(alice); // never revealed by its owner
        for (uint256 i = 1; i < 11; ++i) {
            vm.roll(block.number + 1);
            _mintMysteryAs(bob);
        }
        assertEq(pass.pendingReveals(), 11);
        // Anyone can settle the head and everything behind it; no funding or coordinator is involved.
        vm.roll(block.number + 2);
        vm.prank(bob);
        assertEq(pass.reveal(100), 11);
        assertTrue(pass.tierOf(head) != BMCIlluminatiPass.Tier.Pending);
        for (uint256 id = 41; id <= 51; ++id) {
            assertEq(uint8(pass.revealStatusOf(id)), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
            assertGt(pass.artworkIdOf(id), 0);
        }
        vm.roll(block.number + 2_000_000);
        vm.warp(block.timestamp + 365 days);
        assertEq(pass.pendingReveals(), 0);
        assertEq(pass.revealedCount(), 11);
        assertEq(pass.totalBurned(), 43_850_000e18);
        // Further mints still work with no funding/configuration/callback step.
        assertEq(_mintMysteryAs(alice), 52);
    }

    function test_AuditCIDIsFixedAndNoPostDeploymentConfigurationExists() public {
        assertEq(pass.genesisImagesCID(), "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u");
        vm.startPrank(owner);
        (bool cid,) = address(pass).call(abi.encodeWithSignature("setGenesisImagesCID(string)", "malicious\"cid"));
        (bool config,) = address(pass)
            .call(
                abi.encodeWithSignature(
                    "setVRFConfig(uint256,bytes32,uint32,uint16,bool)", 1, bytes32(uint256(1)), 300000, 3, false
                )
            );
        (bool finalize,) = address(pass).call(abi.encodeWithSignature("finalizeReveals(uint256)", 10));
        (bool callback,) =
            address(pass).call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", 1, new uint256[](1)));
        pass.renounceOwnership();
        vm.stopPrank();
        assertFalse(cid);
        assertFalse(config);
        assertFalse(finalize);
        assertFalse(callback);
        // Even renouncing before the first mint cannot leave a CID or VRF configuration blocker.
        assertEq(_mintGenesisAs(alice), 1);
        for (uint256 i = 1; i < 40; ++i) {
            _mintGenesisAs(alice);
        }
        assertEq(_mintMysteryAs(alice), 41);
    }

    function test_ConstructorRejectsZeroOwnerAndToken() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new BMCIlluminatiPass(address(0), address(bmc));
        vm.expectRevert(bytes("zero address"));
        new BMCIlluminatiPass(owner, address(0));
    }

    function test_MysteryMetadataPermanentAcrossBlocksAndTransfers() public {
        _finishPhase1();
        uint256 id = _mintAndReveal(alice);
        bytes32 metadata = keccak256(bytes(pass.tokenURI(id)));
        vm.prevrandao(bytes32(uint256(999)));
        vm.warp(block.timestamp + 1000);
        vm.roll(block.number + 100);
        vm.prank(alice);
        pass.transferFrom(alice, bob, id);
        _mintAndReveal(alice);
        assertEq(keccak256(bytes(pass.tokenURI(id))), metadata);
    }

    function test_ReentrancyAcrossPhaseBoundaryRollsBackEverything() public {
        for (uint256 i; i < 39; ++i) {
            _mintGenesisAs(alice);
        }
        Reenterer receiver = new Reenterer(pass);
        receiver.setAttackGenesis(false); // Last Genesis receiver attempts the first Mystery mint.
        _fund(address(receiver), GENESIS_PRICE + MYSTERY_PRICE);
        vm.prank(address(receiver));
        bmc.approve(address(pass), GENESIS_PRICE + MYSTERY_PRICE);
        vm.prank(address(receiver));
        vm.expectRevert(bytes("reentered"));
        pass.mintGenesis();
        assertEq(pass.totalMinted(), 39);
        assertEq(pass.totalBurned(), 39 * GENESIS_PRICE);
        assertEq(pass.revealedCount(), 0);
        assertEq(bmc.balanceOf(address(receiver)), GENESIS_PRICE + MYSTERY_PRICE);
    }

    function test_BlockZeroMintAndRevealDoNotUnderflow() public {
        _finishPhase1();
        vm.roll(0);
        assertEq(_mintMysteryAs(alice), 41);
        assertEq(pass.reveal(1), 0);
        vm.roll(2);
        assertEq(pass.reveal(1), 1);
    }
}
