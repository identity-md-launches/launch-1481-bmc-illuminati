// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {BMCIlluminatiPass} from "../src/BMCIlluminatiPass.sol";

contract PassTestFactory {
    function deploy(bytes memory initCode) external returns (address deployed) {
        assembly ("memory-safe") { deployed := create2(0, add(initCode, 32), mload(initCode), 1) }
        require(deployed != address(0), "deployment failed");
    }
}

contract FactoryCompatibilityTest is Test {
    function test_StaticConstructorOnEmptyChainAndRuntimePolicy() public {
        address owner = 0x83027AD9d0D5374335086c539dADD1db983441B0;
        address bmc = 0x38224239f2BDae357D47cb864BC533d7f72dF961;
        vm.chainId(1);
        assertEq(bmc.code.length, 0);
        bytes memory initCode = abi.encodePacked(type(BMCIlluminatiPass).creationCode, abi.encode(owner, bmc));
        assertLe(initCode.length, 49_152);
        PassTestFactory factory = new PassTestFactory();
        BMCIlluminatiPass pass = BMCIlluminatiPass(factory.deploy(initCode));
        assertEq(pass.owner(), owner);
        assertTrue(pass.owner() != address(factory));
        assertEq(address(pass.BMC()), bmc);
        assertEq(pass.genesisImagesCID(), "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u");
        bytes memory runtime = address(pass).code;
        assertGt(runtime.length, 0);
        assertLe(runtime.length, 24_576);
        for (uint256 i; i < runtime.length; ++i) {
            uint8 opcode = uint8(runtime[i]);
            if (opcode >= 0x60 && opcode <= 0x7f) { i += opcode - 0x5f; continue; }
            assertTrue(opcode != 0xf4 && opcode != 0xf2 && opcode != 0xff, "forbidden opcode");
        }
        vm.expectRevert(BMCIlluminatiPass.BMCTokenUnavailable.selector);
        pass.mintGenesis();
    }
}
