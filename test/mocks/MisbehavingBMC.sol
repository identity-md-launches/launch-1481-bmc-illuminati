// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev A BMC stand-in whose behaviour can be switched at runtime so a single deployment of the
///      pass can be driven through every documented token failure: a burnFrom that burns less
///      than asked, one that burns from somebody else, one that mints the amount back to a
///      sink (supply unchanged), one that reverts outright, a wrong decimals() answer, and the
///      honest OpenZeppelin ERC20Burnable semantics the mainnet token follows.
contract MisbehavingBMC is ERC20 {
    enum Mode {
        Honest, // 0: spend allowance, burn exactly `amount`
        BurnLess, // 1: spend allowance, burn amount - 1
        BurnFromOther, // 2: spend allowance, burn `amount` from `victim` instead of `account`
        BurnAndRemint, // 3: burn from account, mint the same amount to `sink` (supply unchanged)
        Revert, // 4: burnFrom reverts
        WrongDecimals, // 5: decimals() returns 6, burnFrom honest
        NoAllowanceCheck // 6: burns exactly `amount` without spending any allowance
    }

    Mode public mode;
    address public victim;
    address public sink;

    constructor() ERC20("Misbehaving BMC", "MBMC") {}

    function setMode(Mode m) external {
        mode = m;
    }

    function setVictim(address v) external {
        victim = v;
    }

    function setSink(address s) external {
        sink = s;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return mode == Mode.WrongDecimals ? 6 : 18;
    }

    function burnFrom(address account, uint256 amount) external {
        Mode m = mode;
        if (m == Mode.Revert) revert("MBMC: burnFrom disabled");
        if (m == Mode.NoAllowanceCheck) {
            _burn(account, amount);
            return;
        }
        _spendAllowance(account, msg.sender, amount);
        if (m == Mode.BurnLess) {
            _burn(account, amount - 1);
        } else if (m == Mode.BurnFromOther) {
            _burn(victim, amount);
        } else if (m == Mode.BurnAndRemint) {
            _burn(account, amount);
            _mint(sink, amount);
        } else {
            _burn(account, amount);
        }
    }
}

/// @dev An ERC-20 with no `decimals()` function at all: the pass must reject it rather than
///      treat a missing answer as 18.
contract NoDecimalsBMC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function burnFrom(address account, uint256 amount) external {
        allowance[account][msg.sender] -= amount;
        balanceOf[account] -= amount;
        totalSupply -= amount;
    }
}

/// @dev An ERC-721 receiver that refuses every token: a mint to it must roll back the burn.
contract RejectingReceiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0xdeadbeef;
    }
}

/// @dev A contract with no receiver hook at all.
contract NoHookReceiver {}
