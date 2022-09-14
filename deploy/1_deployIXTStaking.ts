import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer, proxyAdmin, ixtToken } = await hre.getNamedAccounts();

  await deploy('IXTStaking12months', {
    contract: 'TokenStaking',
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: proxyAdmin,
      proxyContract: 'TransparentUpgradeableProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [deployer, ixtToken, ixtToken, 86400 * 30, 86400 * 360],
        },
      },
    },
  });
};

module.exports = deploy;
module.exports.tags = ['IXTStaking'];
