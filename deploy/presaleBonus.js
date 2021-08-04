const deployPresaleBonus = async function (hre) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer, gameToken, presale } = await getNamedAccounts();
  await deploy('PresaleBonus', {
    from: deployer,
    args: [gameToken, presale],
    log: true,
  });
};

module.exports = deployPresaleBonus;
module.exports.tags = ['PresaleBonus'];
