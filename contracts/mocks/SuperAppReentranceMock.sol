// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import {
    ISuperfluid,
    ISuperToken,
    SuperAppDefinitions
} from '@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol';
import {IConstantFlowAgreementV1} from '@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol';
import {CFAv1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
import {SuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IRicReward} from "../interfaces/IRicReward.sol";

contract SuperAppReentranceMock is SuperAppBase {

    using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData internal _cfav1;

    IRicReward internal _ricReward;
    IERC20 internal _lpToken;

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IRicReward ricReward,
        IERC20 lpToken
    ) {
        _cfav1 = CFAv1Library.InitData(host, cfa);

        _ricReward = ricReward;

        _lpToken = lpToken;

        uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL
            | SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP
            // | SuperAppDefinitions.AFTER_AGREEMENT_CREATED_NOOP
            | SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP
            | SuperAppDefinitions.AFTER_AGREEMENT_UPDATED_NOOP
            | SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP
            | SuperAppDefinitions.AFTER_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);
    }

    function attemptReentrancy() external {
        _lpToken.approve(address(_ricReward), 10e18);
        _ricReward.deposit(_lpToken, 10e18);
    }

    function afterAgreementCreated(
        ISuperToken,
        address,
        bytes32,
        bytes calldata,
        bytes calldata,
        bytes calldata ctx
    ) external override returns (bytes memory) {
        _ricReward.withdraw(_lpToken, 10e18);

        return ctx;
    }
}
