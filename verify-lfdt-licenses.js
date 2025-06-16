#!/usr/bin/env node

/**
 * LFDT License Compliance Verification Script
 *
 * This script checks if npm dependencies comply with LF Decentralized Trust license requirements.
 * Apache-2.0 dependencies are automatically approved.
 * Other licenses must be on the approved list and meet additional criteria.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// LFDT Approved licenses (excluding Apache-2.0 which is auto-approved)
const APPROVED_LICENSES = new Set([
  'BSD-2-Clause',
  'BSD-2-Clause-FreeBSD',
  'BSD-3-Clause',
  'MIT',
  'ISC',
  'Python-2.0',
  'BSL-1.0',
  'Boost',
  'bzip2-1.0.6',
  'OLDAP-2.7',
  'OLDAP-2.8',
  'PostgreSQL',
  'TCL',
  'W3C',
  'X11',
  'Zlib',
  'OFL-1.0',
  'OFL-1.1',
  'CC-BY-1.0',
  'CC-BY-2.0',
  'CC-BY-2.5',
  'CC-BY-3.0',
  'Public Domain',
  'Unlicense',
]);

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

/**
 * Get package.json from the current directory, specified path, or GitHub URL
 */
async function getPackageJson(source = '.') {
  try {
    // Check if source is a GitHub URL
    if (source.includes('github.com') || source.includes('/')) {
      return await fetchPackageJsonFromGitHub(source);
    }

    // Local file path
    const packageJsonPath = path.join(source, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.error(
      `${colors.red}Error reading package.json:${colors.reset}`,
      error.message
    );
    process.exit(1);
  }
}

/**
 * Fetch package.json from a GitHub repository
 */
async function fetchPackageJsonFromGitHub(url) {
  // Extract owner/repo from various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?]+)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  let owner, repo;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      owner = match[1];
      repo = match[2].replace(/\.git$/, '');
      break;
    }
  }

  if (!owner || !repo) {
    throw new Error(
      'Invalid GitHub URL format. Use: https://github.com/owner/repo or owner/repo'
    );
  }

  try {
    console.log(`Fetching package.json from GitHub: ${owner}/${repo}...`);
    const output = execSync(
      `gh api repos/${owner}/${repo}/contents/package.json --jq '.content' | base64 -d`,
      { encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    // Fallback to curl if gh CLI is not available
    try {
      const curlUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`;
      const output = execSync(`curl -s ${curlUrl}`, { encoding: 'utf8' });
      return JSON.parse(output);
    } catch (fallbackError) {
      throw new Error(
        `Failed to fetch package.json from GitHub: ${error.message}`
      );
    }
  }
}

/**
 * Get license information for a package using npm view
 */
function getPackageLicense(packageSpec) {
  try {
    // Clean version string to remove caret, tilde, etc.
    const cleanSpec = packageSpec.replace(/[\^~]/, '');
    const command =
      process.platform === 'win32'
        ? `npm view "${cleanSpec}" license 2>nul`
        : `npm view "${cleanSpec}" license 2>/dev/null`;
    const license = execSync(command, {
      encoding: 'utf8',
    }).trim();
    return license || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Get repository information for a package
 */
function getPackageRepo(packageSpec) {
  try {
    // Clean version string to remove caret, tilde, etc.
    const cleanSpec = packageSpec.replace(/[\^~]/, '');
    const command =
      process.platform === 'win32'
        ? `npm view "${cleanSpec}" repository.url 2>nul`
        : `npm view "${cleanSpec}" repository.url 2>/dev/null`;
    const repoOutput = execSync(command, {
      encoding: 'utf8',
    }).trim();
    // Extract GitHub repo from various URL formats
    const match = repoOutput.match(/github\.com[/:]([\w-]+\/[\w.-]+)/);
    return match ? match[1].replace(/\.git$/, '') : null;
  } catch (error) {
    return null;
  }
}

/**
 * Get GitHub stats for a repository
 */
async function getGitHubStats(repo) {
  if (!repo) return null;

  // List of common repo name variations to try
  const repoVariations = [
    repo,
    repo.endsWith('.js') ? repo : `${repo}.js`,
    repo.endsWith('.js') ? repo.slice(0, -3) : repo,
    repo.endsWith('-js') ? repo : `${repo}-js`,
    repo.endsWith('-js') ? repo.slice(0, -3) : repo,
  ];

  for (const repoName of repoVariations) {
    try {
      // Try to get GitHub stats using gh CLI if available
      const command =
        process.platform === 'win32'
          ? `gh api repos/${repoName} 2>nul`
          : `gh api repos/${repoName} 2>/dev/null`;
      const stats = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(stats);
      return {
        stars: data.stargazers_count,
        forks: data.forks_count,
        created: new Date(data.created_at),
        age: Math.floor(
          (new Date() - new Date(data.created_at)) / (1000 * 60 * 60 * 24 * 30)
        ), // months
        actualRepo: repoName,
      };
    } catch (error) {
      // Try next variation
      continue;
    }
  }

  // If all variations fail, return null
  return null;
}

/**
 * Check if a package meets LFDT requirements
 */
async function checkPackageCompliance(packageName, version) {
  // Clean version and create package spec
  const cleanVersion = version.replace(/[\^~]/, '');
  const packageSpec = `${packageName}@${cleanVersion}`;

  const license = getPackageLicense(packageSpec);
  const repo = getPackageRepo(packageSpec);
  const githubStats = await getGitHubStats(repo);

  const result = {
    name: packageName,
    version: cleanVersion,
    license,
    repo,
    githubStats,
    status: 'unknown',
    reason: '',
  };

  // Apache-2.0 is automatically approved
  if (license === 'Apache-2.0' || license === 'Apache 2.0') {
    result.status = 'approved';
    result.reason = 'Apache-2.0 license (automatically approved)';
  }
  // Check if license is on the approved list
  else if (APPROVED_LICENSES.has(license)) {
    // For non-Apache licenses, check GitHub stats if available
    if (githubStats) {
      if (
        githubStats.age >= 12 &&
        (githubStats.stars >= 10 || githubStats.forks >= 10)
      ) {
        result.status = 'approved';
        result.reason = `${license} license with substantial use (${githubStats.stars} stars, ${githubStats.forks} forks, ${githubStats.age} months old)`;
      } else {
        result.status = 'needs-review';
        result.reason = `${license} license but insufficient GitHub adoption (${githubStats.stars} stars, ${githubStats.forks} forks, ${githubStats.age} months old)`;
      }
    } else {
      // If we can't get GitHub stats, mark as needs-review for manual verification
      result.status = 'needs-review';
      result.reason = `${license} license (approved) but unable to verify substantial use`;
    }
  }
  // Unknown or non-approved license
  else {
    result.status = 'rejected';
    result.reason = `${license} license is not on the LFDT approved list`;
  }

  return result;
}

/**
 * Main function to verify all dependencies
 */
async function verifyDependencies(source) {
  console.log(
    `${colors.blue}LFDT License Compliance Verification${colors.reset}\n`
  );

  const packageJson = await getPackageJson(source);
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  console.log(`Project: ${packageJson.name}@${packageJson.version}`);

  console.log(
    `Checking ${Object.keys(allDependencies).length} dependencies...\n`
  );

  const results = {
    approved: [],
    needsReview: [],
    rejected: [],
  };

  // Check each dependency
  for (const [name, version] of Object.entries(allDependencies)) {
    process.stdout.write(`Checking ${name}...`);
    const result = await checkPackageCompliance(name, version);

    switch (result.status) {
      case 'approved':
        results.approved.push(result);
        console.log(` ${colors.green}✓${colors.reset}`);
        break;
      case 'needs-review':
        results.needsReview.push(result);
        console.log(` ${colors.yellow}⚠${colors.reset}`);
        break;
      case 'rejected':
        results.rejected.push(result);
        console.log(` ${colors.red}✗${colors.reset}`);
        break;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80) + '\n');
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(
    `${colors.green}Approved:${colors.reset} ${results.approved.length}`
  );
  console.log(
    `${colors.yellow}Needs Review:${colors.reset} ${results.needsReview.length}`
  );
  console.log(
    `${colors.red}Rejected:${colors.reset} ${results.rejected.length}`
  );

  // Print detailed results
  if (results.approved.length > 0) {
    console.log(`\n${colors.green}Approved Dependencies:${colors.reset}`);
    results.approved.forEach((dep) => {
      console.log(`  ✓ ${dep.name}@${dep.version}`);
      console.log(`    License: ${dep.license}`);
      console.log(`    Reason: ${dep.reason}`);
    });
  }

  if (results.needsReview.length > 0) {
    console.log(
      `\n${colors.yellow}Dependencies Needing Review:${colors.reset}`
    );
    results.needsReview.forEach((dep) => {
      console.log(`  ⚠ ${dep.name}@${dep.version}`);
      console.log(`    License: ${dep.license}`);
      console.log(`    Reason: ${dep.reason}`);
      if (dep.repo) {
        const actualRepo = dep.githubStats?.actualRepo || dep.repo;
        console.log(`    GitHub: https://github.com/${actualRepo}`);
      }
    });
  }

  if (results.rejected.length > 0) {
    console.log(`\n${colors.red}Rejected Dependencies:${colors.reset}`);
    results.rejected.forEach((dep) => {
      console.log(`  ✗ ${dep.name}@${dep.version}`);
      console.log(`    License: ${dep.license}`);
      console.log(`    Reason: ${dep.reason}`);
    });
  }

  // Exit with error code if any dependencies are rejected
  if (results.rejected.length > 0) {
    console.log(
      `\n${colors.red}ERROR: Found ${results.rejected.length} dependencies with non-compliant licenses${colors.reset}`
    );
    process.exit(1);
  } else if (results.needsReview.length > 0) {
    console.log(
      `\n${colors.yellow}WARNING: ${results.needsReview.length} dependencies need manual review for LFDT compliance${colors.reset}`
    );
  } else {
    console.log(
      `\n${colors.green}SUCCESS: All dependencies are LFDT compliant!${colors.reset}`
    );
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let source = '.';

if (args.length > 0) {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: node verify-lfdt-licenses [source]

Arguments:
  source    Path to local directory, GitHub URL, or owner/repo format
            (default: current directory)

Examples:
  node verify-lfdt-licenses
  node verify-lfdt-licenses /path/to/project
  node verify-lfdt-licenses https://github.com/hashgraph-online/standards-sdk
  node verify-lfdt-licenses hashgraph-online/standards-sdk
`);
    process.exit(0);
  }
  source = args[0];
}

// Run the verification
verifyDependencies(source).catch((error) => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});
