/**
 * Direct test script for menu categories
 * This script directly analyzes module files to identify category issues
 */

const fs = require('fs').promises;
const path = require('path');

// Directly require potential modules that contain category info
const { menuCategories } = require('./src/commands/menu');

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

/**
 * Get the list of all command modules
 */
async function getCommandModules() {
    try {
        const commandsPath = path.join(process.cwd(), 'src/commands');
        const files = await fs.readdir(commandsPath);
        return files.filter(f => f.endsWith('.js') && !f.includes('index'));
    } catch (err) {
        console.error(`${colors.red}Error reading commands directory:${colors.reset}`, err);
        return [];
    }
}

/**
 * Load categories from each command module
 */
async function loadAllCategoriesFromModules() {
    const modules = await getCommandModules();
    const categoryMap = {};
    const globalCategoryList = [];
    
    console.log(`${colors.bold}Found ${modules.length} command modules to analyze${colors.reset}`);
    
    // Track modules by category
    const modulesByCategory = {};
    
    for (const file of modules) {
        try {
            const modulePath = `./src/commands/${file}`;
            console.log(`${colors.cyan}Loading module:${colors.reset} ${file}`);
            
            // Clean the require cache to ensure fresh module loading
            delete require.cache[require.resolve(modulePath)];
            
            // Load the module
            const module = require(modulePath);
            const moduleName = file.replace('.js', '');
            
            if (module && module.category) {
                const category = module.category;
                
                // Add to category map
                if (!categoryMap[category]) {
                    categoryMap[category] = [];
                    modulesByCategory[category] = [];
                }
                
                modulesByCategory[category].push(moduleName);
                
                // Count commands in this module
                if (module.commands && typeof module.commands === 'object') {
                    const commandNames = Object.keys(module.commands);
                    categoryMap[category] = [...categoryMap[category], ...commandNames];
                    console.log(`${colors.green}Module ${moduleName} has ${commandNames.length} commands in category '${category}'${colors.reset}`);
                    
                    // Special handling for group category
                    if (category === 'group') {
                        console.log(`${colors.yellow}GROUP COMMANDS from ${moduleName}:${colors.reset} ${commandNames.join(', ')}`);
                    }
                } else {
                    console.log(`${colors.yellow}Module ${moduleName} has category '${category}' but no commands${colors.reset}`);
                }
                
                // Add to global list if not there
                if (!globalCategoryList.includes(category)) {
                    globalCategoryList.push(category);
                }
            } else {
                console.log(`${colors.yellow}Module ${moduleName} has no category defined${colors.reset}`);
            }
        } catch (err) {
            console.error(`${colors.red}Error loading module ${file}:${colors.reset}`, err);
        }
    }
    
    return { categoryMap, globalCategoryList, modulesByCategory };
}

/**
 * Compare menu categories with module categories
 */
async function analyzeCategories() {
    try {
        console.log(`\n${colors.bold}${colors.magenta}===== ANALYZING MENU CATEGORIES =====${colors.reset}\n`);
        
        // Get categories from modules
        const { categoryMap, globalCategoryList, modulesByCategory } = await loadAllCategoriesFromModules();
        
        console.log(`\n${colors.bold}${colors.blue}===== MODULE CATEGORIES =====${colors.reset}`);
        globalCategoryList.forEach(cat => {
            const commandCount = categoryMap[cat] ? categoryMap[cat].length : 0;
            const moduleCount = modulesByCategory[cat] ? modulesByCategory[cat].length : 0;
            console.log(`${colors.cyan}${cat}${colors.reset}: ${commandCount} commands from ${moduleCount} modules`);
        });
        
        // Check menu categories
        console.log(`\n${colors.bold}${colors.blue}===== MENU CATEGORIES =====${colors.reset}`);
        if (menuCategories && Array.isArray(menuCategories)) {
            menuCategories.forEach(cat => {
                const isInModules = globalCategoryList.includes(cat);
                const status = isInModules ? 
                    `${colors.green}✓ FOUND IN MODULES${colors.reset}` : 
                    `${colors.red}✗ NOT FOUND IN MODULES${colors.reset}`;
                console.log(`${colors.cyan}${cat}${colors.reset}: ${status}`);
            });
            
            // Check for categories in modules not in menu
            console.log(`\n${colors.bold}${colors.blue}===== MISSING FROM MENU =====${colors.reset}`);
            globalCategoryList.forEach(cat => {
                if (!menuCategories.includes(cat)) {
                    console.log(`${colors.yellow}${cat}${colors.reset}: In modules but not in menuCategories`);
                }
            });
        } else {
            console.log(`${colors.red}Error: menuCategories is not properly defined in menu.js${colors.reset}`);
        }
        
        // Specifically check 'group' category
        console.log(`\n${colors.bold}${colors.blue}===== GROUP CATEGORY ANALYSIS =====${colors.reset}`);
        if (categoryMap['group']) {
            console.log(`${colors.green}Found ${categoryMap['group'].length} group commands:${colors.reset} ${categoryMap['group'].join(', ')}`);
            
            // Check if group is in menuCategories
            const groupInMenu = menuCategories && menuCategories.includes('group');
            console.log(`${colors.cyan}Group category in menuCategories:${colors.reset} ${groupInMenu ? colors.green + '✓ YES' : colors.red + '✗ NO'}`);
        } else {
            console.log(`${colors.red}No 'group' category found in modules${colors.reset}`);
        }
        
    } catch (err) {
        console.error(`${colors.red}Analysis error:${colors.reset}`, err);
    }
}

// Run the analysis
analyzeCategories();