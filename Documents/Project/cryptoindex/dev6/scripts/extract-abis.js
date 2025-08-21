const fs = require('fs');
const path = require('path');

/**
 * Extract and export contract ABIs for frontend integration
 */
async function extractABIs() {
    console.log('📋 Extracting Contract ABIs...\n');
    
    const contracts = [
        'IndexTokenFactory',
        'IndexToken',
        'SmartIndexVault',
        'SmartIndexVaultV2',
        'MultiDEXAggregator',
        'SmartAggregator',
        'MockERC20',
        'MockPriceFeed'
    ];
    
    const abis = {};
    const artifactsPath = path.join(__dirname, '../artifacts/contracts');
    const outputPath = path.join(__dirname, '../abi');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    
    for (const contractName of contracts) {
        try {
            // Find contract artifact
            const contractPath = findContractArtifact(artifactsPath, contractName);
            
            if (contractPath) {
                const artifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
                abis[contractName] = artifact.abi;
                
                // Save individual ABI file
                const abiPath = path.join(outputPath, `${contractName}.json`);
                fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
                
                console.log(`✅ ${contractName} ABI extracted`);
            } else {
                console.log(`⚠️  ${contractName} artifact not found`);
            }
        } catch (error) {
            console.log(`❌ Error extracting ${contractName}: ${error.message}`);
        }
    }
    
    // Save combined ABIs file
    const combinedPath = path.join(outputPath, 'contracts.json');
    fs.writeFileSync(combinedPath, JSON.stringify(abis, null, 2));
    
    console.log(`\n✅ All ABIs extracted to: ${outputPath}`);
    console.log(`✅ Combined ABIs saved to: ${combinedPath}`);
    
    // Generate TypeScript types
    generateTypeScriptTypes(abis, outputPath);
}

/**
 * Find contract artifact in nested directories
 */
function findContractArtifact(basePath, contractName) {
    const searchPaths = [
        path.join(basePath, `${contractName}.sol`, `${contractName}.json`),
        path.join(basePath, 'interfaces', `${contractName}.sol`, `${contractName}.json`),
        path.join(basePath, 'mocks', `${contractName}.sol`, `${contractName}.json`)
    ];
    
    for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
            return searchPath;
        }
    }
    
    // Recursive search
    const dirs = fs.readdirSync(basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    for (const dir of dirs) {
        const dirPath = path.join(basePath, dir);
        const artifactPath = path.join(dirPath, `${contractName}.json`);
        
        if (fs.existsSync(artifactPath)) {
            return artifactPath;
        }
    }
    
    return null;
}

/**
 * Generate TypeScript type definitions
 */
function generateTypeScriptTypes(abis, outputPath) {
    console.log('\n📝 Generating TypeScript types...');
    
    let typeContent = `// Auto-generated TypeScript types for smart contracts
// Generated on: ${new Date().toISOString()}

export interface ContractAddresses {
    priceFeed: string;
    factory: string;
    vault: string;
    aggregator: string;
    tokens: {
        WETH: string;
        WBTC: string;
        USDC: string;
    };
}

export interface ComponentToken {
    tokenAddress: string;
    targetRatio: number;
}

export interface IndexFund {
    name: string;
    symbol: string;
    creator: string;
    components: ComponentToken[];
    indexTokenAddress: string;
    totalSupply: bigint;
    createdAt: number;
    isActive: boolean;
    isIssued: boolean;
}

export interface SwapRequest {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    minAmountOut: bigint;
    recipient: string;
    deadline: number;
    routeData?: string;
}

export interface SwapResult {
    amountOut: bigint;
    gasUsed: bigint;
    dexUsed: number;
    slippage: number;
}

export interface VaultInfo {
    totalAssets: bigint;
    totalSupply: bigint;
    managementFee: number;
    performanceFee: number;
    highWaterMark: bigint;
}

export type DEXType = 'UniswapV3' | 'OneInch' | 'SushiSwap' | 'Balancer' | 'Curve';

// Contract ABIs
`;
    
    for (const [contractName, abi] of Object.entries(abis)) {
        typeContent += `export const ${contractName}ABI = ${JSON.stringify(abi, null, 2)} as const;\n\n`;
    }
    
    const typesPath = path.join(outputPath, 'types.ts');
    fs.writeFileSync(typesPath, typeContent);
    
    console.log(`✅ TypeScript types generated: ${typesPath}`);
}

// Execute
extractABIs().catch(console.error);
