require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-ethers')
require('hardhat-erc1820')
require('solidity-coverage')
require('hardhat-gas-reporter')
require('hardhat-dependency-compiler')

module.exports = {
	solidity: {
		version: '0.8.13',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	},
	dependencyCompiler: {
		paths: [
			'@superfluid-finance/ethereum-contracts/contracts/agreements/InstantDistributionAgreementV1.sol'
		]
	}
}
