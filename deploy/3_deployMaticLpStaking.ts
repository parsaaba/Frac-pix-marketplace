import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer, proxyAdmin, ixtToken, ixtMaticLpToken } = await hre.getNamedAccounts();

  await deploy('MaticLPStaking', {
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
          args: [deployer, ixtToken, ixtMaticLpToken, 86400 * 30, 86400 * 30],
        },
      },
    },
  });
};

module.exports = deploy;
module.exports.tags = ['MaticLPStaking'];
