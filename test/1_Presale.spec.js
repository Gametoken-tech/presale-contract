const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');

describe('Presale', () => {
  let owner;
  let alice;
  let bob;
  let treasury;
  let accounts;
  let gameToken;
  let presale;
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
  });

  describe('constructor', () => {
    it('Revert if game token is zero', async () => {
      const Presale = await ethers.getContractFactory('Presale');
      await expect(
        Presale.deploy(constants.ZERO_ADDRESS, treasury.address, PERIOD),
      ).to.be.revertedWith('PRESALE: game token cannot be zero');
    });

    it('Revert if treasury is zero', async () => {
      const Presale = await ethers.getContractFactory('Presale');
      await expect(
        Presale.deploy(gameToken.address, constants.ZERO_ADDRESS, PERIOD),
      ).to.be.revertedWith('PRESALE: treasury cannot be zero');
    });

    it('Revert if period is zero', async () => {
      const Presale = await ethers.getContractFactory('Presale');
      await expect(
        Presale.deploy(gameToken.address, treasury.address, '0'),
      ).to.be.revertedWith('PRESALE: period cannot be zero');
    });
  });

  describe('Check token metadata', () => {
    it('Check game token', async () => {
      expect(await presale.gameToken()).to.equal(gameToken.address);
    });

    it('Check treasury', async () => {
      expect(await presale.treasury()).to.equal(treasury.address);
    });

    it('Check period', async () => {
      expect(await presale.period()).to.equal(PERIOD);
    });

    it('Check owner', async () => {
      expect(await presale.owner()).to.equal(owner.address);
    });

    it('Check participants', async () => {
      expect(await presale.participants()).to.equal(0);
    });
  });

  describe('setTreasury', () => {
    it('Revert if msg.sender is not owner', async () => {
      await expect(
        presale.connect(alice).setTreasury(bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Revert if treasury is zero', async () => {
      await expect(
        presale.connect(owner).setTreasury(constants.ZERO_ADDRESS),
      ).to.be.revertedWith('PRESALE: treasury cannot be zero');
    });

    it('Set treasury', async () => {
      await presale.connect(owner).setTreasury(bob.address);
      expect(await presale.treasury()).to.equal(bob.address);
    });
  });

  describe('setPeriod', () => {
    const newPeriod = 86400;

    it('Revert if msg.sender is not owner', async () => {
      await expect(
        presale.connect(alice).setPeriod(newPeriod),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Revert if period is zero', async () => {
      await expect(presale.connect(owner).setPeriod('0')).to.be.revertedWith(
        'PRESALE: period cannot be zero',
      );
    });

    it('Set period', async () => {
      await presale.connect(owner).setPeriod(newPeriod);
      expect(await presale.period()).to.equal(newPeriod);
    });
  });

  describe('start', () => {
    it('Revert if msg.sender is not owner', async () => {
      await expect(
        presale.connect(alice).scheduleStart(10000000),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Revert if start time is lower than block time', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).sub(
        '100',
      );
      await expect(
        presale.connect(owner).scheduleStart(startTime),
      ).to.be.revertedWith('PRESALE: must be greater than block time');
    });

    it('Start and emit Started event', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      const tx = await presale.connect(owner).scheduleStart(startTime);
      expect(await presale.startTime()).to.equal(startTime);
      expect(tx).to.emit(presale, 'ScheduleStart').withArgs(startTime);
    });

    it('Revert if already scheduled', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await expect(
        presale.connect(owner).scheduleStart(startTime),
      ).to.be.revertedWith('PRESALE: already scheduled');
    });

    it('Revert invest if not started', async () => {
      await expect(
        alice.sendTransaction({
          to: presale.address,
          value: ethers.utils.parseEther('1.0'),
        }),
      ).to.be.revertedWith('PRESALE: not started');

      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('50');

      await expect(
        alice.sendTransaction({
          to: presale.address,
          value: ethers.utils.parseEther('1.0'),
        }),
      ).to.be.revertedWith('PRESALE: not started');
    });
  });

  describe('invest', () => {
    beforeEach(async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
    });

    it('Revert if amount is zero', async () => {
      await expect(
        alice.sendTransaction({
          to: presale.address,
          value: '0',
        }),
      ).to.be.revertedWith('PRESALE: amount cannot be zero');
    });

    it('Invest and update state', async () => {
      const amount1 = ethers.utils.parseEther('20.0');
      let tx = await alice.sendTransaction({
        to: presale.address,
        value: amount1,
      });
      expect(await owner.provider.getBalance(presale.address)).to.equal(
        amount1,
      );
      expect(tx).to.emit(presale, 'Invested').withArgs(alice.address, amount1);
      expect(await presale.invested(alice.address)).to.equal(amount1);
      expect(await presale.totalInvested()).to.equal(amount1);
      expect(await presale.participants()).to.equal(1);

      amount2 = ethers.utils.parseEther('10.0');
      tx = await bob.sendTransaction({
        to: presale.address,
        value: amount2,
      });
      expect(await owner.provider.getBalance(presale.address)).to.equal(
        amount1.add(amount2),
      );
      expect(tx).to.emit(presale, 'Invested').withArgs(bob.address, amount2);
      expect(await presale.invested(bob.address)).to.equal(amount2);
      expect(await presale.totalInvested()).to.equal(amount1.add(amount2));
      expect(await presale.participants()).to.equal(2);

      amount3 = ethers.utils.parseEther('5.0');
      tx = await alice.sendTransaction({
        to: presale.address,
        value: amount3,
      });
      expect(await owner.provider.getBalance(presale.address)).to.equal(
        amount1.add(amount2).add(amount3),
      );
      expect(tx).to.emit(presale, 'Invested').withArgs(alice.address, amount3);
      expect(await presale.invested(alice.address)).to.equal(
        amount1.add(amount3),
      );
      expect(await presale.totalInvested()).to.equal(
        amount1.add(amount2).add(amount3),
      );
      expect(await presale.participants()).to.equal(2);
    });

    it('Revert if target reached', async () => {
      await expect(
        alice.sendTransaction({
          to: presale.address,
          value: PRESALE_TARGET.add(BigNumber.from('1')),
        }),
      ).to.be.revertedWith('PRESALE: reached to target');

      const amount = ethers.utils.parseEther('100.0');
      await alice.sendTransaction({
        to: presale.address,
        value: amount,
      });
      await expect(
        bob.sendTransaction({
          to: presale.address,
          value: PRESALE_TARGET.sub(amount).add(BigNumber.from('1')),
        }),
      ).to.be.revertedWith('PRESALE: reached to target');
    });

    it('Revert if presale finished', async () => {
      const amount = ethers.utils.parseEther('100.0');
      await alice.sendTransaction({
        to: presale.address,
        value: amount,
      });
      await time.increase(PERIOD.toString());
      await expect(
        bob.sendTransaction({
          to: presale.address,
          value: amount,
        }),
      ).to.be.revertedWith('PRESALE: ended');
    });
  });

  describe('isFinished', () => {
    it('false if not started', async () => {
      expect(await presale.isFinished()).to.equal(false);

      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('50');

      expect(await presale.isFinished()).to.equal(false);
    });

    it('false if target not reached and period not reached', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await alice.sendTransaction({
        to: presale.address,
        value: ethers.utils.parseEther('100.0'),
      });
      await time.increase((PERIOD / 2).toString());
      expect(await presale.isFinished()).to.equal(false);
    });

    it('true if target reached', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      for (let i = 0; i < 200; i += 1) {
        await accounts[i].sendTransaction({
          to: presale.address,
          value: HARD_CAP,
        });
      }
      expect(await presale.isFinished()).to.equal(true);
    });

    it('true after period', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await time.increase((PERIOD + 1).toString());
      expect(await presale.isFinished()).to.equal(true);
    });
  });

  describe('allowClaimGame', () => {
    it('Revert if msg.sender is not owner', async () => {
      await expect(presale.connect(alice).allowClaimGame()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('Revert if not started', async () => {
      await expect(presale.connect(owner).allowClaimGame()).to.be.revertedWith(
        'PRESALE: not finished',
      );
    });

    it('Revert if not finished', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await expect(presale.connect(owner).allowClaimGame()).to.be.revertedWith(
        'PRESALE: not finished',
      );
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
      await expect(presale.connect(owner).allowClaimGame()).to.be.revertedWith(
        'PRESALE: No enough GAME',
      );
    });

    it('Allow claim game if finished and emit AllowClaim event', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      expect(await presale.canClaimGame()).to.equal(false);
      await time.increase(PERIOD.toString());
      const tx = await presale.connect(owner).allowClaimGame();
      expect(await presale.canClaimGame()).to.equal(true);
      expect(tx).to.emit(presale, 'AllowClaim').withArgs();
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
        presale.address,
        HARD_CAP.div(BigNumber.from('10')).add(100),
      );
      expect(await presale.canClaimGame()).to.equal(false);
      await time.increase(PERIOD.toString());
      const ownerBalance = await gameToken.balanceOf(owner.address);
      const tx = await presale.connect(owner).allowClaimGame();
      expect(await gameToken.balanceOf(presale.address)).to.equal(
        HARD_CAP.div(BigNumber.from('10')),
      );
      expect(await gameToken.balanceOf(owner.address)).to.equal(
        ownerBalance.add(BigNumber.from('100')),
      );
      expect(await presale.canClaimGame()).to.equal(true);
      expect(tx).to.emit(presale, 'AllowClaim').withArgs();
    });
  });

  describe('claim', () => {
    it('Revert if claim not allowed', async () => {
      await expect(presale.connect(alice).claim()).to.be.revertedWith(
        'PRESALE: not allowed',
      );

      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await expect(presale.connect(alice).claim()).to.be.revertedWith(
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
      await presale.connect(owner).allowClaimGame();

      await expect(presale.connect(bob).claim()).to.be.revertedWith(
        'PRESALE: not invested',
      );
    });

    it('Claim GAME token and emit Claimed event', async () => {
      await gameToken.transfer(
        presale.address,
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

      let tx = await presale.connect(alice).claim();
      expect(tx)
        .to.emit(presale, 'Claimed')
        .withArgs(alice.address, HARD_CAP.div(BigNumber.from('10')));
      expect(await presale.claimed(alice.address)).to.equal(true);

      tx = await presale.connect(bob).claim();
      expect(tx)
        .to.emit(presale, 'Claimed')
        .withArgs(
          bob.address,
          ethers.utils.parseEther('10').div(BigNumber.from('10')),
        );
      expect(await presale.claimed(bob.address)).to.equal(true);
    });

    it('Revert if already claimed', async () => {
      await gameToken.transfer(
        presale.address,
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

      await presale.connect(alice).claim();
      await presale.connect(bob).claim();

      await expect(presale.connect(alice).claim()).to.be.revertedWith(
        'PRESALE: already claimed',
      );
      await expect(presale.connect(bob).claim()).to.be.revertedWith(
        'PRESALE: already claimed',
      );
    });
  });

  describe('withdraw', () => {
    it('Revert if msg.sender is not owner', async () => {
      await expect(presale.connect(alice).withdraw()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('Revert if not started', async () => {
      await expect(presale.connect(owner).withdraw()).to.be.revertedWith(
        'PRESALE: not finished',
      );
    });

    it('Revert if not finished', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await expect(presale.connect(owner).withdraw()).to.be.revertedWith(
        'PRESALE: not finished',
      );
    });

    it('Withdraw ONE and emit Withdrawn event', async () => {
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

      let totalInvest = HARD_CAP.add(ethers.utils.parseEther('10'));
      expect(await owner.provider.getBalance(presale.address)).to.equal(
        totalInvest,
      );

      const treasuryBalanceBefore = await treasury.getBalance();
      const tx = await presale.connect(owner).withdraw();

      expect(tx).to.emit(presale, 'Withdrawn').withArgs(totalInvest);

      expect(await owner.provider.getBalance(presale.address)).to.equal('0');

      expect(await treasury.getBalance()).to.equal(
        treasuryBalanceBefore.add(totalInvest),
      );
    });

    it('Revert if already withdrawn', async () => {
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

      await presale.connect(owner).withdraw();
      await expect(presale.connect(owner).withdraw()).to.be.revertedWith(
        'PRESALE: already withdrawn',
      );
    });

    it('Revert if no invest', async () => {
      const startTime = BigNumber.from((await time.latest()).toString()).add(
        '100',
      );
      await presale.connect(owner).scheduleStart(startTime);
      await time.increase('100');
      await time.increase(PERIOD.toString());

      await expect(presale.connect(owner).withdraw()).to.be.revertedWith(
        'PRESALE: no invests',
      );
    });
  });
});
