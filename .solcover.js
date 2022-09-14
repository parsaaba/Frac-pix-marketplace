module.exports = {
  skipFiles: [
    'mock',
    'libraries/FixedPoint.sol',
    'libraries/FullMath.sol',
    'libraries/UniswapV2OracleLibrary.sol',
    'Airdrop.sol',
  ],
  configureYulOptimizer: true,
};
