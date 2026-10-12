// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BMCIlluminatiPass} from "../../src/BMCIlluminatiPass.sol";
import {MisbehavingBMC} from "../mocks/MisbehavingBMC.sol";
import {PassHandler} from "./PassHandler.sol";

/// @notice Properties that must hold after every call of every random sequence the handler drives.
///         Shared by the open (rehearsal-chain), history-enabled and mainnet-gated suites below.
abstract contract PassInvariantsBase is Test {
    uint256 constant GENESIS_PRICE = 1_000_000e18;
    uint256 constant MYSTERY_PRICE = 350_000e18;

    MisbehavingBMC bmc;
    BMCIlluminatiPass pass;
    PassHandler handler;
    address owner = makeAddr("owner");

    function _deploy(bool withHistory) internal {
        bmc = new MisbehavingBMC();
        pass = new BMCIlluminatiPass(owner, address(bmc));
        handler = new PassHandler(pass, bmc, owner, withHistory);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](13);
        selectors[0] = PassHandler.mintGenesis.selector;
        selectors[1] = PassHandler.mintGenesisBatch.selector;
        selectors[2] = PassHandler.mintMystery.selector;
        selectors[3] = PassHandler.mintMysteryBatch.selector;
        selectors[4] = PassHandler.mintUnderfunded.selector;
        selectors[5] = PassHandler.setTokenMode.selector;
        selectors[6] = PassHandler.reveal.selector;
        selectors[7] = PassHandler.advanceBlocks.selector;
        selectors[8] = PassHandler.jumpPastWindow.selector;
        selectors[9] = PassHandler.transfer.selector;
        selectors[10] = PassHandler.openMinting.selector;
        selectors[11] = PassHandler.reveal.selector; // weighted twice: reveals follow mints
        selectors[12] = PassHandler.mintMysteryBatch.selector; // weighted twice: 460 mystery mints to sell out
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // ------------------------------------------------------------------ conservation

    /// Every BMC the pass ever took was destroyed: supply fell by exactly the recorded burn, the
    /// pass holds nothing, and its own counter agrees with what the handler watched happen.
    function invariant_burnConservation() public view {
        assertEq(pass.totalBurned(), handler.ghostBurned(), "totalBurned != burns observed");
        assertEq(bmc.totalSupply(), handler.ghostFunded() - handler.ghostBurned(), "BMC supply != funded - burned");
        assertEq(bmc.balanceOf(address(pass)), 0, "pass must never hold BMC");
        assertLe(pass.totalBurned(), pass.MAX_TOTAL_BURN());
    }

    /// The burn total is fully determined by how many tokens of each phase exist.
    function invariant_burnMatchesMintCount() public view {
        uint256 minted = pass.totalMinted();
        uint256 genesis = minted < 40 ? minted : 40;
        uint256 mystery = minted > 40 ? minted - 40 : 0;
        assertEq(pass.totalBurned(), genesis * GENESIS_PRICE + mystery * MYSTERY_PRICE, "burn != price * count");
        assertEq(minted, handler.ghostTotalMinted(), "totalMinted != mints observed");
        assertEq(genesis, handler.ghostGenesisMints());
        assertEq(mystery, handler.ghostMysteryMints());
    }

    /// No actor's BMC ever went anywhere except into a mint it received a token for.
    function invariant_actorsOnlyPayForMints() public view {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            assertEq(bmc.balanceOf(a), handler.ghostFundedOf(a) - handler.ghostSpentOf(a), "actor balance drifted");
        }
    }

    // ------------------------------------------------------------------ supply and phase views

    function invariant_supplyBoundsAndViews() public view {
        uint256 minted = pass.totalMinted();
        assertLe(minted, 500, "cap exceeded");
        assertEq(pass.totalSupply(), minted);
        assertEq(pass.remainingSupply(), 500 - minted);
        assertEq(pass.genesisPhaseActive(), minted < 40);
        assertEq(pass.remainingMysteryMints(), minted < 40 ? 460 : 500 - minted);
        if (minted >= 500) assertEq(pass.currentPrice(), 0, "sold out has no price");
        else if (minted < 40) assertEq(pass.currentPrice(), GENESIS_PRICE);
        else assertEq(pass.currentPrice(), MYSTERY_PRICE);
    }

    // ------------------------------------------------------------------ reveal accounting

    function invariant_revealAccounting() public view {
        uint256 minted = pass.totalMinted();
        uint256 mystery = minted > 40 ? minted - 40 : 0;
        uint256 revealed = pass.revealedCount();
        assertLe(revealed, mystery, "revealed more than minted");
        assertEq(revealed, handler.ghostRevealed(), "revealedCount != outcomes observed");
        assertEq(pass.pendingReveals(), mystery - revealed);
        assertLe(pass.mysteryGenesisRevealed(), 37);
        assertEq(pass.mysteryGenesisRevealed(), handler.ghostMysteryGenesis());
        assertEq(revealed - pass.mysteryGenesisRevealed(), handler.ghostMysteryStandard());
        assertLe(revealed - pass.mysteryGenesisRevealed(), 423);
        assertEq(pass.remainingMysteryGenesis() + pass.remainingMysteryStandard(), 460 - revealed, "pool size");
        if (revealed < mystery) assertEq(pass.nextRevealId(), 41 + revealed);
        else assertEq(pass.nextRevealId(), 0);
    }

    /// Token state follows the id ranges exactly: fixed Genesis for 1..40, settled outcomes for the
    /// revealed prefix, pending for the rest, and a settled outcome never changes afterwards.
    function invariant_tokenStateFollowsRevealOrder() public view {
        uint256 minted = pass.totalMinted();
        uint256 revealedUpTo = 40 + pass.revealedCount();
        for (uint256 id = 1; id <= minted; ++id) {
            BMCIlluminatiPass.Tier tier = pass.tierOf(id);
            uint16 art = pass.artworkIdOf(id);
            BMCIlluminatiPass.RevealStatus status = pass.revealStatusOf(id);
            if (id <= 40) {
                assertEq(
                    uint8(tier),
                    uint8(id == 1 ? BMCIlluminatiPass.Tier.LegendaryGenesis : BMCIlluminatiPass.Tier.Genesis),
                    "genesis phase tier"
                );
                assertEq(art, uint16(id), "genesis phase artwork");
                assertEq(uint8(status), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
                assertEq(pass.revealBlockOf(id), 0);
            } else if (id <= revealedUpTo) {
                assertTrue(
                    tier == BMCIlluminatiPass.Tier.Genesis || tier == BMCIlluminatiPass.Tier.Standard, "settled tier"
                );
                assertEq(uint8(status), uint8(BMCIlluminatiPass.RevealStatus.Revealed));
                assertEq(keccak256(abi.encode(tier, art)), handler.ghostOutcome(id), "settled outcome changed");
            } else {
                assertEq(uint8(tier), uint8(BMCIlluminatiPass.Tier.Pending), "unsettled token must be pending");
                assertEq(art, 0, "pending token leaks artwork");
                assertEq(handler.ghostOutcome(id), bytes32(0));
                uint256 revealBlock = pass.revealBlockOf(id);
                assertEq(pass.revealDeadlineOf(id), revealBlock + 8191);
                assertEq(
                    uint8(status),
                    uint8(
                        revealBlock < block.number
                            ? BMCIlluminatiPass.RevealStatus.RandomnessStored
                            : BMCIlluminatiPass.RevealStatus.AwaitingRandomness
                    ),
                    "pending status vs block"
                );
            }
        }
    }

    // ------------------------------------------------------------------ ERC-721 custody

    /// Every minted token has exactly one holder among the actors; nothing is lost or duplicated.
    function invariant_tokensHeldByActors() public view {
        uint256 n = handler.actorCount();
        uint256 held;
        for (uint256 i; i < n; ++i) {
            held += pass.balanceOf(handler.actors(i));
        }
        assertEq(held, pass.totalMinted(), "token custody");
    }

    // ------------------------------------------------------------------ launch gate

    /// Minting is one-way: once open it stays open, and nothing is ever minted or burned while closed.
    function invariant_gateIsOneWayAndClosedMeansNothingMinted() public view {
        if (handler.ghostOpened()) assertTrue(pass.mintingOpen(), "gate closed again");
        if (!pass.mintingOpen()) {
            assertEq(pass.totalMinted(), 0, "minted while closed");
            assertEq(pass.totalBurned(), 0, "burned while closed");
        }
        assertEq(pass.owner(), owner, "owner changed");
    }

    // ------------------------------------------------------------------ reachability

    /// Drives the handler through a complete sellout and re-checks every invariant at the end, so the
    /// properties above are known to be evaluated at the sold-out, fully revealed state too.
    function _scriptedSellout() internal {
        if (!pass.mintingOpen()) handler.openMinting(0);
        handler.mintUnderfunded(1, 7, true);
        for (uint256 i; i < 4; ++i) {
            handler.mintGenesisBatch(i, 10);
        }
        assertEq(pass.totalMinted(), 40);
        handler.mintGenesis(3); // phase over: must be rejected
        handler.mintUnderfunded(2, 8, false);
        for (uint256 i; i < 23; ++i) {
            handler.mintMysteryBatch(i, 20);
            handler.advanceBlocks(2, i);
            handler.reveal(i, 25);
        }
        assertEq(pass.totalMinted(), 500);
        handler.mintMystery(1); // sold out: must be rejected
        handler.advanceBlocks(2, 99);
        handler.reveal(0, 520);
        assertEq(pass.revealedCount(), 460);
        handler.transfer(0, 1, 1);
        handler.setTokenMode(4);
        handler.mintMystery(2);
        invariant_burnConservation();
        invariant_burnMatchesMintCount();
        invariant_actorsOnlyPayForMints();
        invariant_supplyBoundsAndViews();
        invariant_revealAccounting();
        invariant_tokenStateFollowsRevealOrder();
        invariant_tokensHeldByActors();
        invariant_gateIsOneWayAndClosedMeansNothingMinted();
        assertEq(pass.mysteryGenesisRevealed(), 37);
        assertEq(pass.remainingMysteryStandard(), 0);
        assertEq(pass.totalBurned(), pass.MAX_TOTAL_BURN());
        assertGt(handler.callsGenesisRejected(), 0);
        assertGt(handler.callsMysteryRejected(), 0);
        assertGt(handler.callsUnderfundedRejected(), 0);
        assertGt(handler.callsTokenFaultRejected(), 0);
    }
}

/// @notice Rehearsal-chain deployment (open from construction), native 256-block reveal window only.
/// forge-config: default.invariant.runs = 48
/// forge-config: default.invariant.depth = 150
/// forge-config: default.invariant.fail-on-revert = true
contract BMCIlluminatiPassOpenInvariants is PassInvariantsBase {
    function setUp() public {
        _deploy(false);
        assertTrue(pass.mintingOpen());
    }

    function test_ScriptedSelloutReachesEveryInvariant() public {
        _scriptedSellout();
    }

    /// Forced settlements (window expired, no history contract) must hand out Standard while any
    /// Standard remains, which the handler asserts; this checks the path was exercised at all.
    function test_ForcedPathIsExercised() public {
        handler.mintGenesisBatch(0, 10);
        handler.mintGenesisBatch(1, 10);
        handler.mintGenesisBatch(2, 10);
        handler.mintGenesisBatch(3, 10);
        handler.mintMysteryBatch(0, 5);
        handler.advanceBlocks(300, 1); // beyond the native window, no history: forced Standard
        handler.reveal(0, 10);
        assertEq(handler.ghostForcedReveals(), 5);
        assertEq(pass.remainingMysteryGenesis(), 37);
    }
}

/// @notice Same, with the EIP-2935 history stand-in present so reveals up to 8,191 blocks old settle
///         from the stored hash and only older ones are forced.
/// forge-config: default.invariant.runs = 24
/// forge-config: default.invariant.depth = 120
/// forge-config: default.invariant.fail-on-revert = true
contract BMCIlluminatiPassHistoryInvariants is PassInvariantsBase {
    function setUp() public {
        _deploy(true);
        assertGt(pass.BLOCK_HISTORY().code.length, 0);
    }

    function test_ScriptedSelloutReachesEveryInvariant() public {
        _scriptedSellout();
    }

    function test_HistoryPathIsExercised() public {
        handler.mintGenesisBatch(0, 10);
        handler.mintGenesisBatch(1, 10);
        handler.mintGenesisBatch(2, 10);
        handler.mintGenesisBatch(3, 10);
        handler.mintMysteryBatch(0, 3);
        handler.advanceBlocks(300, 1); // the reveal block is older than 256 but recorded in history
        handler.reveal(0, 10);
        assertEq(handler.ghostRevealed(), 3);
        assertEq(handler.ghostForcedReveals(), 0, "history-served reveal must not be forced");
        handler.mintMysteryBatch(1, 2);
        handler.jumpPastWindow();
        handler.reveal(0, 10);
        assertEq(handler.ghostForcedReveals(), 2, "past the window it is forced even with history");
    }
}

/// @notice Mainnet (chain id 1) deployment: closed from construction until the owner opens it.
/// forge-config: default.invariant.runs = 40
/// forge-config: default.invariant.depth = 150
/// forge-config: default.invariant.fail-on-revert = true
contract BMCIlluminatiPassGatedInvariants is PassInvariantsBase {
    function setUp() public {
        vm.chainId(1);
        _deploy(false);
        assertFalse(pass.mintingOpen(), "mainnet deployment must start closed");
    }

    function test_ScriptedSelloutReachesEveryInvariant() public {
        handler.openMinting(1); // an actor cannot open the gate
        assertFalse(pass.mintingOpen());
        _scriptedSellout();
        assertTrue(handler.ghostOpened());
        assertEq(handler.callsOpenRejected(), 1);
    }

    function test_NothingMintsBeforeTheOwnerOpens() public {
        handler.mintGenesisBatch(0, 10);
        handler.mintMysteryBatch(0, 5);
        handler.openMinting(1); // actor, not owner
        handler.mintGenesis(2);
        assertEq(pass.totalMinted(), 0);
        assertEq(pass.totalBurned(), 0);
        assertEq(handler.callsGenesisRejected(), 11);
        assertEq(handler.callsMysteryRejected(), 5);
        assertEq(handler.callsOpenRejected(), 1);
        invariant_gateIsOneWayAndClosedMeansNothingMinted();
        handler.openMinting(0); // owner
        handler.openMinting(0); // owner again: already open
        assertEq(handler.callsOpenOk(), 1);
        assertEq(handler.callsOpenRejected(), 2);
        handler.mintGenesis(2);
        assertEq(pass.totalMinted(), 1);
    }
}
