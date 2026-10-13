// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BMCIlluminatiPass} from "../src/BMCIlluminatiPass.sol";
import {IBMCToken} from "../src/interfaces/IBMCToken.sol";

/// @notice LOCAL fork rehearsal only. No broadcast and no production configuration changes.
/// Run at the recorded verification block; offline suites skip when the deployment is absent.
contract DeployedWebsiteForkTest is Test {
    address constant PASS = 0xEdD2Be808e73bC443bc12Aa07586193c193e8d51;
    address constant BMC = 0x38224239f2BDae357D47cb864BC533d7f72dF961;
    BMCIlluminatiPass pass = BMCIlluminatiPass(PASS);
    IBMCToken token = IBMCToken(BMC);
    address buyer = address(0xBEEF);

    function test_DeployedGenesisBurnAndLaunchGate() public {
        vm.skip(block.chainid != 1 || PASS.code.length == 0);
        assertFalse(pass.mintingOpen());
        assertEq(pass.totalMinted(), 0);
        assertEq(address(pass.BMC()), BMC);
        deal(BMC, buyer, 1_000_000e18, true);
        uint256 supply = token.totalSupply();
        vm.startPrank(buyer);
        token.approve(PASS, 1_000_000e18);
        vm.expectRevert(BMCIlluminatiPass.MintingNotOpen.selector);
        pass.mintGenesis();
        vm.stopPrank();
        assertEq(token.balanceOf(buyer), 1_000_000e18);
        vm.prank(pass.owner());
        pass.openMinting(); // Impersonation on the LOCAL fork only.
        vm.prank(buyer);
        uint256 id = pass.mintGenesis();
        assertEq(id, 1);
        assertEq(pass.ownerOf(id), buyer);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(token.allowance(buyer, PASS), 0);
        assertEq(token.totalSupply(), supply - 1_000_000e18);
        assertEq(token.balanceOf(PASS), 0);
        assertGt(bytes(pass.tokenURI(id)).length, 0);
    }

    function test_DeployedMysteryBurnAndExplicitReveal() public {
        vm.skip(block.chainid != 1 || PASS.code.length == 0);
        uint256 cost = 40_350_000e18;
        deal(BMC, buyer, cost, true);
        uint256 supply = token.totalSupply();
        vm.prank(pass.owner());
        pass.openMinting();
        vm.startPrank(buyer);
        for (uint256 i; i < 40; ++i) {
            token.approve(PASS, 1_000_000e18);
            pass.mintGenesis();
        }
        token.approve(PASS, 350_000e18);
        uint256 id = pass.mintMystery();
        vm.stopPrank();
        assertEq(id, 41);
        assertEq(uint256(pass.tierOf(id)), 0);
        assertEq(pass.pendingReveals(), 1);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(token.allowance(buyer, PASS), 0);
        assertEq(token.totalSupply(), supply - cost);
        assertEq(token.balanceOf(PASS), 0);
        uint256 mintBlock = block.number;
        vm.roll(mintBlock + 2);
        vm.setBlockhash(mintBlock + 1, keccak256("local fork reveal fixture"));
        assertEq(pass.reveal(1), 1);
        assertGt(uint256(pass.tierOf(id)), 0);
        assertEq(pass.pendingReveals(), 0);
        assertGt(bytes(pass.tokenURI(id)).length, 0);
    }
}
