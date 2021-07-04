require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('hardhat-deploy');
require('solidity-coverage');
require('dotenv').config();

module.exports = {
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: '100000000000000000000000000',
        count: 200,
      },
      allowUnlimitedContractSize: true,
      timeout: 1000000,
    },
    mainnet: {
      url: 'https://api.harmony.one',
      chainId: 1666600000,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    testnet: {
      url: 'https://api.s0.b.hmny.io',
      chainId: 1666700000,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
  },
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    gameToken: {
      1666700000: '0xdC97423e9c6129640Fe72ca6909E8D032029C1e0',
    },
    treasury: {
      1666700000: '0x7638Ae4db07cb6e00b8952b238062D6c19b7830c',
    },
  },
};
