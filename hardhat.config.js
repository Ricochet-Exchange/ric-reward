require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-ethers')
require('hardhat-erc1820')

module.exports = {
	solidity: {
		version: '0.8.12',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	}
}
