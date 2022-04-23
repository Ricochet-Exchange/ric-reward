const { Framework } = require('@superfluid-finance/sdk-core')
const { assert } = require('chai')
const { ethers, network } = require('hardhat')
const deploySuperfluid = require('./helpers/deploySuperfluid')

let deployer, alice, bob, sf, DAI, DAix, signer

before(async function () {
	;[deployer, alice, bob] = await ethers.getSigners()

	const resolverAddress = await deploySuperfluid(deployer)

	sf = await Framework.create({
		networkName: 'custom',
		provider: deployer.provider,
		dataMode: 'WEB3_ONLY',
		resolverAddress,
		protocolReleaseVersion: 'test'
	})
})

describe('smoke test', async function () {
	it('deployment works', function () {
		assert(true)
	})
})
