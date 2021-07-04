const deployPresale = async function (hre) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer, gameToken, treasury } = await getNamedAccounts();
  const period = 1209600; // 2 weeks
  await deploy('Presale', {
    from: deployer,
    args: [gameToken, treasury, period],
    log: true,
  });
};

module.exports = deployPresale;
