const { Framework } = require('@superfluid-finance/sdk-core')
const { assert, expect } = require('chai')
const { ethers, network } = require('hardhat')
const { deploySuperfluid, deployRicochet } = require('./helpers/deployers')

// CONSTANTS
const stakeUpdateEvent = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes('StakeUpdate(address,address,uint256)')
)
const rewardUpdateEvent = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes('RewardUpdate(address,bool)')
)
const ten = ethers.utils.parseEther('10').toString()
const five = ethers.utils.parseEther('5').toString()
const flowRateDepositRatio = '2'
const thirtyDays = '2592000' // in seconds
const overOrUnderFlow = '0x11' // EVM panic code

// VARIABLES ASSIGNED IN HOOKS
let deployer,
	alice,
	bob,
	sf,
	superTokenFactory,
	ricochet,
	resolverAddress,
	ricReward,
	lpToken0,
	lpToken1,
	invalidLpToken

// SIMPLE HELPERS
const getBlockTimestamp = async provider =>
	(await provider.getBlock(await provider.getBlockNumber())).timestamp * 1000

const computeFlowRate = deposit =>
	ethers.BigNumber.from(deposit).mul(flowRateDepositRatio).div(100).div(thirtyDays).toString()

// type Logs = Array<{ topics: Array<string> }>
// this concats all `topics` from `logs`, then searches them for an EVM event signature
const containsEvent = (logs, event) =>
	logs.reduce((prevVal, curr) => prevVal.concat(curr.topics), []).includes(event)

before(async function () {
	// get signers
	;[deployer, alice, bob] = await ethers.getSigners()

	// deploy superfluid contracts and ricochet token
	;[resolverAddress, superTokenFactory] = await deploySuperfluid(deployer)

	// init client framework
	sf = await Framework.create({
		networkName: 'custom',
		provider: deployer.provider,
		dataMode: 'WEB3_ONLY',
		resolverAddress,
		protocolReleaseVersion: 'test'
	})
})

beforeEach(async function () {
	// deploy Ricochet token each time since total supply is hard coded
	ricochet = await deployRicochet(superTokenFactory, deployer)

	// deploy contract
	const RicRewardFactory = await ethers.getContractFactory('RicReward', deployer)

	ricReward = await RicRewardFactory.deploy(
		sf.settings.config.hostAddress,
		sf.settings.config.cfaV1Address,
		ricochet.address
	)

	// deploy mock LP Tokens
	const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock', deployer)

	lpToken0 = await ERC20MockFactory.deploy('LP Token 0', 'LPT0')

	lpToken1 = await ERC20MockFactory.deploy('LP Token 1', 'LPT1')

	invalidLpToken = await ERC20MockFactory.deploy('Invalid LP Token', 'ILPT')

	// register LP Tokens
	await ricReward.connect(deployer).setRewardActive(lpToken0.address, true)
	await ricReward.connect(deployer).setRewardActive(lpToken1.address, true)
	// Ricochet Token allocation of 10_000_000 * 1e18
	await ricochet.connect(deployer).transfer(ricReward.address, ethers.utils.parseEther('1000000'))
})

describe('State Getters', async function () {
	it('Shows LP Token 0 Rewards Active', async function () {
		assert.equal(await ricReward.rewardActive(lpToken0.address), true)
	})

	it('Shows LP Token 1 Rewards Active', async function () {
		assert.equal(await ricReward.rewardActive(lpToken1.address), true)
	})

	it('Shows Invalid LP Token to be Inactive', async function () {
		assert.equal(await ricReward.rewardActive(invalidLpToken.address), false)
	})

	it('Shows Flow Rate Deposit Ratio', async function () {
		assert.equal((await ricReward.flowRateDepositRatio()).toString(), flowRateDepositRatio)
	})

	it('Shows Deposits', async function () {
		assert.equal((await ricReward.deposits(alice.address, lpToken0.address)).toString(), '0')
	})
})

describe('State Updatooors', async function () {
	it('Can Deposit LP Tokens', async function () {
		await lpToken0.connect(alice).mint(ten)
		await lpToken0.connect(alice).approve(ricReward.address, ten)
		const tx = await ricReward.connect(alice).deposit(lpToken0.address, ten)

		const { logs } = await tx.wait()

		const { timestamp, flowRate } = await sf.cfaV1.getFlow({
			superToken: ricochet.address,
			sender: ricReward.address,
			receiver: alice.address,
			providerOrSigner: alice
		})

		assert(containsEvent(logs, stakeUpdateEvent))
		assert.equal((await lpToken0.balanceOf(alice.address)).toString(), '0')
		assert.equal((await lpToken0.balanceOf(ricReward.address)).toString(), ten)
		assert.equal((await ricReward.deposits(alice.address, lpToken0.address)).toString(), ten)
		assert.equal(Number(timestamp), await getBlockTimestamp(ethers.provider))
		assert.equal(flowRate, computeFlowRate(ten))
	})

	it('Can Withdraw All of LP Tokens', async function () {
		await lpToken0.connect(alice).mint(ten)
		await lpToken0.connect(alice).approve(ricReward.address, ten)
		await ricReward.connect(alice).deposit(lpToken0.address, ten)
		const tx = await ricReward.connect(alice).withdraw(lpToken0.address, ten)

		const { logs } = await tx.wait()

		const { timestamp, flowRate } = await sf.cfaV1.getFlow({
			superToken: ricochet.address,
			sender: ricReward.address,
			receiver: alice.address,
			providerOrSigner: alice
		})

		assert(containsEvent(logs, stakeUpdateEvent))
		assert.equal((await lpToken0.balanceOf(ricReward.address)).toString(), '0')
		assert.equal((await lpToken0.balanceOf(alice.address)).toString(), ten)
		assert.equal((await ricReward.deposits(alice.address, lpToken0.address)).toString(), '0')
		assert.equal(Number(timestamp), 0)
		assert.equal(flowRate.toString(), '0')
	})

	it('Can Withdraw Some of LP Tokens', async function () {
		await lpToken0.connect(alice).mint(ten)
		await lpToken0.connect(alice).approve(ricReward.address, ten)
		await ricReward.connect(alice).deposit(lpToken0.address, ten)
		const tx = await ricReward.connect(alice).withdraw(lpToken0.address, five)

		const { logs } = await tx.wait()

		const { timestamp, flowRate } = await sf.cfaV1.getFlow({
			superToken: ricochet.address,
			sender: ricReward.address,
			receiver: alice.address,
			providerOrSigner: alice
		})

		assert(containsEvent(logs, stakeUpdateEvent))
		assert.equal((await lpToken0.balanceOf(ricReward.address)).toString(), five)
		assert.equal((await lpToken0.balanceOf(alice.address)).toString(), five)
		assert.equal((await ricReward.deposits(alice.address, lpToken0.address)).toString(), five)
		assert.equal(Number(timestamp), await getBlockTimestamp(ethers.provider))
		assert.equal(flowRate, computeFlowRate(five))
	})

	it('Can Withdraw LP Tokens While Rewards Inactive', async function () {
		await lpToken0.connect(alice).mint(ten)
		await lpToken0.connect(alice).approve(ricReward.address, ten)
		await ricReward.connect(alice).deposit(lpToken0.address, ten)
		await ricReward.connect(deployer).setRewardActive(lpToken0.address, false)
		const tx = await ricReward.connect(alice).withdraw(lpToken0.address, ten)

		const { logs } = await tx.wait()

		const { timestamp, flowRate } = await sf.cfaV1.getFlow({
			superToken: ricochet.address,
			sender: ricReward.address,
			receiver: alice.address,
			providerOrSigner: alice
		})

		assert(containsEvent(logs, stakeUpdateEvent))
		assert.equal((await lpToken0.balanceOf(alice.address)).toString(), ten)
		assert.equal((await lpToken0.balanceOf(ricReward.address)).toString(), '0')
		assert.equal((await ricReward.deposits(alice.address, lpToken0.address)).toString(), '0')
		assert.equal(Number(timestamp), 0)
		assert.equal(flowRate.toString(), '0')
	})

	it('Does NOT Update Deposits When Invalid Tokens Transferred', async function () {
		await invalidLpToken.connect(alice).mint(ten)
		await invalidLpToken.connect(alice).transfer(ricReward.address, ten)

		assert.equal((await invalidLpToken.balanceOf(ricReward.address)).toString(), ten)
		assert.equal(
			(await ricReward.deposits(alice.address, invalidLpToken.address)).toString(),
			'0'
		)
	})
})

describe('Admin State Updates', async function () {
	it('Can Set Rewards Active for Any Token', async function () {
		const tx = await ricReward.connect(deployer).setRewardActive(invalidLpToken.address, true)

		const { logs } = await tx.wait()

		assert(containsEvent(logs, rewardUpdateEvent))
		assert(await ricReward.rewardActive(invalidLpToken.address))
	})

	it('Can Set Rewards Inactive', async function () {
		await ricReward.connect(deployer).setRewardActive(lpToken0.address, false)

		assert(!(await ricReward.rewardActive(lpToken0.address)))
	})

	it('Can Set Rewards Inactive, then Active again', async function () {
		await ricReward.connect(deployer).setRewardActive(lpToken0.address, false)
		await ricReward.connect(deployer).setRewardActive(lpToken0.address, true)

		assert(await ricReward.rewardActive(lpToken0.address))
	})
})

describe('Expected Revert Cases', async function () {
	it('Cannot Deposit Inactive Token', async function () {
		await invalidLpToken.connect(alice).mint(ten)
		await invalidLpToken.connect(alice).approve(ricReward.address, ten)

		await expect(
			ricReward.connect(alice).deposit(invalidLpToken.address, ten)
		).to.be.revertedWith('RicReward__RewardsInactive()')
	})

	it('Cannot Withdraw More Than Deposited', async function () {
		await expect(ricReward.connect(alice).withdraw(lpToken0.address, '1')).to.be.revertedWith(
			overOrUnderFlow
		)
	})

	it('Cannot Reenter', async function () {
		const factory = await ethers.getContractFactory('SuperAppReentranceMock', deployer)
		const maliciousSuperApp = await factory.deploy(
			sf.settings.config.hostAddress,
			sf.settings.config.cfaV1Address,
			ricReward.address,
			lpToken0.address
		)

		await lpToken0.connect(alice).mint(ten)
		await lpToken0.connect(alice).transfer(maliciousSuperApp.address, ten)

		await expect(maliciousSuperApp.connect(alice).attemptReentrancy()).to.be.revertedWith(
			'ReentrancyGuard: reentrant call'
		)
	})

	it('Cannot Change Rewards Status as Non Admin', async function () {
		await expect(
			ricReward.connect(alice).setRewardActive(lpToken0.address, false)
		).to.be.revertedWith('Ownable: caller is not the owner')
	})
})

describe('End To End Tests', async function () {
	it('Scenario 1', async function () {
		// alice deposit 0
		// bob deposit invalid
		// alice deposit 1
		// bob deposit 0
		// alice withdraw 0 half
		// bob withdraw
		// deployer sets inactive
		// alice withdraw
	})
})
