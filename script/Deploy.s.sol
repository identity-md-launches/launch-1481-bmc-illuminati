// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {BMCIlluminatiPass} from "../src/BMCIlluminatiPass.sol";

/// @notice Deployment script. Mainnet values are constants; `run()` reads only the owner from the
///         environment and hands a config to `deploy`, which tests call directly.
contract DeployBMCIlluminatiPass is Script {
    /// @dev BMC Illuminati token, Ethereum mainnet (verified 2026-10-12: 18 decimals, burnFrom present).
    address public constant MAINNET_BMC = 0x38224239f2BDae357D47cb864BC533d7f72dF961;
    struct Config {
        address owner;
        address bmc;
    }

    function mainnetConfig(address owner) public pure returns (Config memory) {
        return Config({owner: owner, bmc: MAINNET_BMC});
    }

    function deploy(Config memory cfg) public returns (BMCIlluminatiPass pass) {
        require(cfg.owner != address(0), "owner required");
        pass = new BMCIlluminatiPass(cfg.owner, cfg.bmc);
    }

    /// @dev Simulation only. Deployment is the launch factory's responsibility after authorization.
    function run() external returns (BMCIlluminatiPass pass) {
        address owner = vm.envAddress("OWNER");
        pass = deploy(mainnetConfig(owner));
    }
}
