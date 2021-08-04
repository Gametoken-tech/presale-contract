const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');

describe('PresaleBonus', () => {
  let owner;
  let alice;
  let bob;
  let treasury;
  let accounts;
  let gameToken;
  let presale;
  let presaleBonus;
  const decimalsUnit = BigNumber.from('10').pow(BigNumber.from('18'));
  const TOTAL_SUPPLY = BigNumber.from('16000000').mul(decimalsUnit);
  const PERIOD = 604800; // 1 week
  const PRESALE_TARGET = BigNumber.from('10000000').mul(decimalsUnit);
  const HARD_CAP = BigNumber.from('50000').mul(decimalsUnit);

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [owner, alice, bob, carol, treasury] = accounts;
    const GameToken = await ethers.getContractFactory('MockERC20');
    gameToken = await GameToken.deploy(TOTAL_SUPPLY);
    const Presale = await ethers.getContractFactory('Presale');
    presale = await Presale.deploy(gameToken.address, treasury.address, PERIOD);
    const PresaleBonus = await ethers.getContractFactory('PresaleBonus');
    presaleBonus = await PresaleBonus.deploy(
      gameToken.address,
      presale.address,
    );
  });

  describe('constructor', () => {
    it('Revert if game token is zero', async () => {
      const PresaleBonus = await ethers.getContractFactory('PresaleBonus');
      await expect(
        PresaleBonus.deploy(constants.ZERO_ADDRESS, presale.address),
      ).to.be.revertedWith('PRESALE: game token cannot be zero');
    });

    it('Revert if presale is zero', async () => {
      const PresaleBonus = await ethers.getContractFactory('PresaleBonus');
      await expect(
        PresaleBonus.deploy(gameToken.address, constants.ZERO_ADDRESS),
      ).to.be.revertedWith('PRESALE: presale cannot be zero');
    });
  });

  describe('Check token metadata', () => {
    it('Check game token', async () => {
      expect(await presaleBonus.gameToken()).to.equal(gameToken.address);
    });

    it('Check presale', async () => {
      expect(await presaleBonus.presale()).to.equal(presale.address);
    });

    it('Check owner', async () => {
      expect(await presaleBonus.owner()).to.equal(owner.address);
    });
  });

  describe('allowClaimGame', () => {
    it('Revert if msg.sender is not owner', async () => {
      await expect(
        presaleBonus.connect(alice).allowClaimGame(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Revert if not enough GAME in contract', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: HARD_CAP,
      });

      await time.increase(PERIOD.toString());
      await expect(
        presaleBonus.connect(owner).allowClaimGame(),
      ).to.be.revertedWith('PRESALE: No enough GAME');
    });

    it('Allow claim game if finished and emit AllowClaim event', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      expect(await presale.canClaimGame()).to.equal(false);
      await time.increase(PERIOD.toString());
      await presale.connect(owner).allowClaimGame();
      const tx = await presaleBonus.connect(owner).allowClaimGame();
      expect(await presaleBonus.canClaimGame()).to.equal(true);
      expect(tx).to.emit(presaleBonus, 'AllowClaim').withArgs();
    });

    it('Withdraw remaining GAME token', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: HARD_CAP,
      });
      await gameToken.transfer(
        presaleBonus.address,
        HARD_CAP.div(BigNumber.from('20')).add(100),
      );
      await gameToken.transfer(
        presale.address,
        HARD_CAP.div(BigNumber.from('10')).add(100),
      );
      expect(await presale.canClaimGame()).to.equal(false);
      await time.increase(PERIOD.toString());
      const ownerBalance = await gameToken.balanceOf(owner.address);
      await presaleBonus.connect(owner).allowClaimGame();
      expect(await gameToken.balanceOf(presaleBonus.address)).to.equal(
        HARD_CAP.div(BigNumber.from('20')),
      );
      expect(await gameToken.balanceOf(owner.address)).to.equal(
        ownerBalance.add(BigNumber.from('100')),
      );
      expect(await presaleBonus.canClaimGame()).to.equal(true);
    });
  });

  describe('claim', () => {
    it('Revert if claim not allowed', async () => {
      await expect(presaleBonus.connect(alice).claim()).to.be.revertedWith(
        'PRESALE: not allowed',
      );

      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await expect(presaleBonus.connect(alice).claim()).to.be.revertedWith(
        'PRESALE: not allowed',
      );
    });

    it('Revert if not invested', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: HARD_CAP,
      });
      await time.increase(PERIOD.toString());
      await gameToken.transfer(
        presale.address,
        HARD_CAP.div(BigNumber.from('10')),
      );
      await gameToken.transfer(
        presaleBonus.address,
        HARD_CAP.div(BigNumber.from('10')),
      );
      await presale.connect(owner).allowClaimGame();
      await presaleBonus.connect(owner).allowClaimGame();

      await expect(presaleBonus.connect(bob).claim()).to.be.revertedWith(
        'PRESALE: not invested',
      );
    });

    it('Claim GAME token and emit Claimed event', async () => {
      await gameToken.transfer(
        presale.address,
        PRESALE_TARGET.div(BigNumber.from('10')),
      );
      await gameToken.transfer(
        presaleBonus.address,
        PRESALE_TARGET.div(BigNumber.from('20')),
      );
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: HARD_CAP,
      });
      await bob.sendTransaction({
        to: presale.address,
        value: ethers.utils.parseEther('10'),
      });
      await time.increase(PERIOD.toString());
      await presale.connect(owner).allowClaimGame();
      await presaleBonus.connect(owner).allowClaimGame();

      let tx = await presale.connect(alice).claim();
      expect(tx)
        .to.emit(presale, 'Claimed')
        .withArgs(alice.address, HARD_CAP.div(BigNumber.from('10')));
      expect(await presale.claimed(alice.address)).to.equal(true);

      tx = await presaleBonus.connect(alice).claim();
      expect(tx)
        .to.emit(presaleBonus, 'BonusClaimed')
        .withArgs(alice.address, HARD_CAP.div(BigNumber.from('20')));
      expect(await presaleBonus.claimed(alice.address)).to.equal(true);

      tx = await presale.connect(bob).claim();
      expect(tx)
        .to.emit(presale, 'Claimed')
        .withArgs(
          bob.address,
          ethers.utils.parseEther('10').div(BigNumber.from('10')),
        );
      expect(await presale.claimed(bob.address)).to.equal(true);

      tx = await presaleBonus.connect(bob).claim();
      expect(tx)
        .to.emit(presaleBonus, 'BonusClaimed')
        .withArgs(
          bob.address,
          ethers.utils.parseEther('10').div(BigNumber.from('20')),
        );
      expect(await presaleBonus.claimed(bob.address)).to.equal(true);
    });

    it('Revert if already claimed', async () => {
      await gameToken.transfer(
        presale.address,
        PRESALE_TARGET.div(BigNumber.from('10')),
      );
      await gameToken.transfer(
        presaleBonus.address,
        PRESALE_TARGET.div(BigNumber.from('10')),
      );
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: HARD_CAP,
      });
      await bob.sendTransaction({
        to: presale.address,
        value: ethers.utils.parseEther('10'),
      });
      await time.increase(PERIOD.toString());
      await presale.connect(owner).allowClaimGame();
      await presaleBonus.connect(owner).allowClaimGame();

      await presaleBonus.connect(alice).claim();
      await presaleBonus.connect(bob).claim();

      await expect(presaleBonus.connect(alice).claim()).to.be.revertedWith(
        'PRESALE: already claimed',
      );
      await expect(presaleBonus.connect(bob).claim()).to.be.revertedWith(
        'PRESALE: already claimed',
      );
    });
  });
});
