/**
 * Educational Command Module
 * Educational tools and utilities for WhatsApp Bot
 */

// Import required modules
const logger = require('../../utils/logger');
const axios = require('axios');
const mathjs = require('mathjs');
const { safeSendText } = require('../../utils/jidHelper');

// Create a basic educational module
const educationalCommands = {
    async translate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [targetLang, ...textParts] = args;
            const textToTranslate = textParts.join(' ');

            if (!targetLang || !textToTranslate) {
                await safeSendText(sock, remoteJid, '*🌐 Usage:* .translate [target_language] [text]\nExample: .translate es Hello, how are you?');
                return;
            }

            // Target language should be a valid 2-letter ISO language code
            const validLanguageCodes = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];

            if (!validLanguageCodes.includes(targetLang.toLowerCase())) {
                await safeSendText(sock, remoteJid, '*❌ Invalid target language code*\nPlease use a valid 2-letter ISO language code (e.g., "es" for Spanish).');
                return;
            }

            await safeSendText(sock, remoteJid, '🔄 Translating...');

            // Use a free translation API
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;

            const response = await axios.get(url);

            if (response.data && response.data[0] && response.data[0][0]) {
                const translation = response.data[0].map(item => item[0]).join('');
                const detectedLang = response.data[2];

                await safeSendText(sock, remoteJid, `*🌐 Translation (${detectedLang} → ${targetLang})*\n\n${translation}`);
            } else {
                await safeSendText(sock, remoteJid, '*❌ Translation failed*\nPlease try again with a different text or language.');
            }
        } catch (err) {
            logger.error('Error in translate command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error translating text');
        }
    },

    async dictionary(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ').trim();

            if (!word) {
                await safeSendText(sock, remoteJid, '*📚 Usage:* .dictionary [word]\nExample: .dictionary serendipity');
                return;
            }

            await safeSendText(sock, remoteJid, '🔍 Looking up word...');

            // Use a free dictionary API
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

            if (response.data && response.data.length > 0) {
                const entry = response.data[0];
                let result = `*📚 ${entry.word}*\n`;
                
                if (entry.phonetic) {
                    result += `Pronunciation: ${entry.phonetic}\n`;
                }
                
                result += '\n';

                // Get definitions
                if (entry.meanings && entry.meanings.length > 0) {
                    entry.meanings.forEach((meaning, index) => {
                        if (index < 3) { // Limit to 3 meanings to avoid overflow
                            result += `*${meaning.partOfSpeech}*\n`;
                            
                            meaning.definitions.slice(0, 2).forEach((def, idx) => {
                                result += `${idx + 1}. ${def.definition}\n`;
                                
                                if (def.example) {
                                    result += `   Example: "${def.example}"\n`;
                                }
                            });
                            
                            result += '\n';
                        }
                    });
                }
                
                await safeSendText(sock, remoteJid, result);
            } else {
                await safeSendText(sock, remoteJid, `*❌ Word not found*\nCould not find the word "${word}" in the dictionary.`);
            }
        } catch (err) {
            logger.error('Error in dictionary command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error looking up word');
        }
    },

    async define(sock, message, args) {
        return await this.dictionary(sock, message, args);
    },

    async calculate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const expression = args.join(' ').trim();

            if (!expression) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .calculate [expression]\nExample: .calculate 2 + 2 * 3');
                return;
            }

            try {
                // Safely evaluate the expression
                const result = mathjs.evaluate(expression);
                await safeSendText(sock, remoteJid, `*🔢 ${expression} = ${result}*`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Math Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in calculate command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error in calculation');
        }
    },

    async periodic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const element = args[0]?.trim();

            if (!element) {
                await safeSendText(sock, remoteJid, '*🧪 Usage:* .periodic [element]\nExample: .periodic Na');
                return;
            }

            // Define periodic table elements (simplified)
            const elements = {
                'h': { name: 'Hydrogen', symbol: 'H', atomicNumber: 1, weight: 1.008 },
                'he': { name: 'Helium', symbol: 'He', atomicNumber: 2, weight: 4.0026 },
                'li': { name: 'Lithium', symbol: 'Li', atomicNumber: 3, weight: 6.94 },
                'be': { name: 'Beryllium', symbol: 'Be', atomicNumber: 4, weight: 9.0122 },
                'b': { name: 'Boron', symbol: 'B', atomicNumber: 5, weight: 10.81 },
                'c': { name: 'Carbon', symbol: 'C', atomicNumber: 6, weight: 12.011 },
                'n': { name: 'Nitrogen', symbol: 'N', atomicNumber: 7, weight: 14.007 },
                'o': { name: 'Oxygen', symbol: 'O', atomicNumber: 8, weight: 15.999 },
                'f': { name: 'Fluorine', symbol: 'F', atomicNumber: 9, weight: 18.998 },
                'ne': { name: 'Neon', symbol: 'Ne', atomicNumber: 10, weight: 20.180 },
                'na': { name: 'Sodium', symbol: 'Na', atomicNumber: 11, weight: 22.990 },
                'mg': { name: 'Magnesium', symbol: 'Mg', atomicNumber: 12, weight: 24.305 },
                'al': { name: 'Aluminum', symbol: 'Al', atomicNumber: 13, weight: 26.982 },
                'si': { name: 'Silicon', symbol: 'Si', atomicNumber: 14, weight: 28.085 },
                'p': { name: 'Phosphorus', symbol: 'P', atomicNumber: 15, weight: 30.974 },
                's': { name: 'Sulfur', symbol: 'S', atomicNumber: 16, weight: 32.06 },
                'cl': { name: 'Chlorine', symbol: 'Cl', atomicNumber: 17, weight: 35.45 },
                'ar': { name: 'Argon', symbol: 'Ar', atomicNumber: 18, weight: 39.948 },
                'k': { name: 'Potassium', symbol: 'K', atomicNumber: 19, weight: 39.098 },
                'ca': { name: 'Calcium', symbol: 'Ca', atomicNumber: 20, weight: 40.078 },
                'fe': { name: 'Iron', symbol: 'Fe', atomicNumber: 26, weight: 55.845 },
                'cu': { name: 'Copper', symbol: 'Cu', atomicNumber: 29, weight: 63.546 },
                'zn': { name: 'Zinc', symbol: 'Zn', atomicNumber: 30, weight: 65.38 },
                'ag': { name: 'Silver', symbol: 'Ag', atomicNumber: 47, weight: 107.87 },
                'au': { name: 'Gold', symbol: 'Au', atomicNumber: 79, weight: 196.97 },
                'pb': { name: 'Lead', symbol: 'Pb', atomicNumber: 82, weight: 207.2 },
                'u': { name: 'Uranium', symbol: 'U', atomicNumber: 92, weight: 238.03 }
            };

            // Find element by symbol, case-insensitive
            const key = element.toLowerCase();
            const foundElement = elements[key];

            if (foundElement) {
                const response = `*🧪 ${foundElement.name} (${foundElement.symbol})*\n\n• Atomic Number: ${foundElement.atomicNumber}\n• Atomic Weight: ${foundElement.weight} u\n\nElement ${foundElement.atomicNumber} in the periodic table.`;
                await safeSendText(sock, remoteJid, response);
            } else {
                await safeSendText(sock, remoteJid, `*❌ Element not found*\nCould not find element with symbol "${element}".`);
            }
        } catch (err) {
            logger.error('Error in periodic command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving element information');
        }
    },

    // 5. Math commands
    async simplify(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const expression = args.join(' ').trim();

            if (!expression) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .simplify [expression]\nExample: .simplify 2x + 3x');
                return;
            }

            try {
                const simplified = mathjs.simplify(expression).toString();
                await safeSendText(sock, remoteJid, `*🔢 Simplified Expression*\n\nOriginal: ${expression}\nSimplified: ${simplified}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Math Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in simplify command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error simplifying expression');
        }
    },
    
    async derivative(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 2) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .derivative [expression] [variable]\nExample: .derivative x^2 x');
                return;
            }
            
            const variable = args.pop();
            const expression = args.join(' ').trim();
            
            try {
                const result = mathjs.derivative(expression, variable).toString();
                await safeSendText(sock, remoteJid, `*🔢 Derivative*\n\nExpression: ${expression}\nWith respect to: ${variable}\nResult: ${result}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Math Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in derivative command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error calculating derivative');
        }
    },
    
    async integral(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 2) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .integral [expression] [variable]\nExample: .integral 2x x');
                return;
            }
            
            const variable = args.pop();
            const expression = args.join(' ').trim();
            
            await safeSendText(sock, remoteJid, `*🔢 Integral*\n\nExpression: ${expression}\nWith respect to: ${variable}\n\nNote: Symbolic integration requires advanced mathematical libraries. Try using an online calculator for this operation.`);
        } catch (err) {
            logger.error('Error in integral command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error calculating integral');
        }
    },
    
    async solve(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 2) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .solve [equation] [variable]\nExample: .solve 2x + 3 = 7 x');
                return;
            }
            
            const variable = args.pop();
            const equation = args.join(' ').trim();
            
            try {
                // Extract left and right parts from the equation
                const parts = equation.split('=');
                if (parts.length !== 2) {
                    throw new Error('Invalid equation format. Use equals sign (=)');
                }
                
                const left = parts[0].trim();
                const right = parts[1].trim();
                
                // Move everything to left side
                const expr = `${left} - (${right})`;
                
                // Solve the equation
                const solution = mathjs.solve(expr, variable);
                await safeSendText(sock, remoteJid, `*🔢 Equation Solution*\n\nEquation: ${equation}\nVariable: ${variable}\nSolution: ${variable} = ${solution}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Math Error:* ${error.message}\n\nNote: Complex equations may require more advanced solving methods.`);
            }
        } catch (err) {
            logger.error('Error in solve command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error solving equation');
        }
    },
    
    // 6. Conversion functions
    async convertLength(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '*📏 Usage:* .convertlength [value] [from_unit] [to_unit]\nExample: .convertlength 5 meters feet');
                return;
            }
            
            const value = parseFloat(args[0]);
            const fromUnit = args[1].toLowerCase();
            const toUnit = args[2].toLowerCase();
            
            if (isNaN(value)) {
                await safeSendText(sock, remoteJid, '*❌ Error:* Please provide a valid numeric value');
                return;
            }
            
            try {
                const result = mathjs.convert(value, fromUnit, toUnit);
                await safeSendText(sock, remoteJid, `*📏 Length Conversion*\n\n${value} ${fromUnit} = ${result} ${toUnit}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Conversion Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in convertLength command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error converting length units');
        }
    },
    
    async convertTemperature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '*🌡️ Usage:* .converttemperature [value] [from_unit] [to_unit]\nExample: .converttemperature 32 fahrenheit celsius');
                return;
            }
            
            const value = parseFloat(args[0]);
            const fromUnit = args[1].toLowerCase();
            const toUnit = args[2].toLowerCase();
            
            if (isNaN(value)) {
                await safeSendText(sock, remoteJid, '*❌ Error:* Please provide a valid numeric value');
                return;
            }
            
            try {
                const result = mathjs.convert(value, fromUnit, toUnit);
                await safeSendText(sock, remoteJid, `*🌡️ Temperature Conversion*\n\n${value} ${fromUnit} = ${result} ${toUnit}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Conversion Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in convertTemperature command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error converting temperature units');
        }
    },
    
    async convertWeight(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '*⚖️ Usage:* .convertweight [value] [from_unit] [to_unit]\nExample: .convertweight 5 kilograms pounds');
                return;
            }
            
            const value = parseFloat(args[0]);
            const fromUnit = args[1].toLowerCase();
            const toUnit = args[2].toLowerCase();
            
            if (isNaN(value)) {
                await safeSendText(sock, remoteJid, '*❌ Error:* Please provide a valid numeric value');
                return;
            }
            
            try {
                const result = mathjs.convert(value, fromUnit, toUnit);
                await safeSendText(sock, remoteJid, `*⚖️ Weight Conversion*\n\n${value} ${fromUnit} = ${result} ${toUnit}`);
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Conversion Error:* ${error.message}`);
            }
        } catch (err) {
            logger.error('Error in convertWeight command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error converting weight units');
        }
    },
    
    // 7. Science commands
    async planetsInfo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const planetName = args.join(' ').toLowerCase().trim();
            
            if (!planetName) {
                await safeSendText(sock, remoteJid, '*🪐 Usage:* .planetsinfo [planet_name]\nExample: .planetsinfo mars');
                return;
            }
            
            // Planet data
            const planets = {
                'mercury': {
                    name: 'Mercury',
                    diameter: '4,879 km',
                    mass: '3.3011 × 10^23 kg',
                    distanceFromSun: '57.9 million km',
                    orbitalPeriod: '88 days',
                    rotationPeriod: '58.6 days',
                    moons: 0,
                    funFact: 'Mercury has wrinkles! As the core of the planet cooled and contracted, the surface developed "wrinkles".'
                },
                'venus': {
                    name: 'Venus',
                    diameter: '12,104 km',
                    mass: '4.8675 × 10^24 kg',
                    distanceFromSun: '108.2 million km',
                    orbitalPeriod: '225 days',
                    rotationPeriod: '243 days',
                    moons: 0,
                    funFact: 'Venus rotates in the opposite direction to most planets, meaning the Sun rises in the west and sets in the east.'
                },
                'earth': {
                    name: 'Earth',
                    diameter: '12,742 km',
                    mass: '5.97237 × 10^24 kg',
                    distanceFromSun: '149.6 million km',
                    orbitalPeriod: '365.24 days',
                    rotationPeriod: '23.9 hours',
                    moons: 1,
                    funFact: 'Earth is the only known planet where water can exist in liquid form on the surface.'
                },
                'mars': {
                    name: 'Mars',
                    diameter: '6,779 km',
                    mass: '6.4171 × 10^23 kg',
                    distanceFromSun: '227.9 million km',
                    orbitalPeriod: '687 days',
                    rotationPeriod: '24.6 hours',
                    moons: 2,
                    funFact: 'Mars has the largest dust storms in our solar system, which can last for months and cover the entire planet.'
                },
                'jupiter': {
                    name: 'Jupiter',
                    diameter: '139,820 km',
                    mass: '1.8982 × 10^27 kg',
                    distanceFromSun: '778.5 million km',
                    orbitalPeriod: '11.86 years',
                    rotationPeriod: '9.9 hours',
                    moons: 79,
                    funFact: 'Jupiter\'s Great Red Spot is a storm that has been raging for at least 400 years.'
                },
                'saturn': {
                    name: 'Saturn',
                    diameter: '116,460 km',
                    mass: '5.6834 × 10^26 kg',
                    distanceFromSun: '1.434 billion km',
                    orbitalPeriod: '29.45 years',
                    rotationPeriod: '10.7 hours',
                    moons: 82,
                    funFact: 'Saturn\'s rings are mostly made of ice particles, with a small amount of rocky debris and dust.'
                },
                'uranus': {
                    name: 'Uranus',
                    diameter: '50,724 km',
                    mass: '8.6810 × 10^25 kg',
                    distanceFromSun: '2.871 billion km',
                    orbitalPeriod: '84.02 years',
                    rotationPeriod: '17.2 hours',
                    moons: 27,
                    funFact: 'Uranus rotates on its side, giving it seasons that last for 20 years.'
                },
                'neptune': {
                    name: 'Neptune',
                    diameter: '49,244 km',
                    mass: '1.02413 × 10^26 kg',
                    distanceFromSun: '4.495 billion km',
                    orbitalPeriod: '164.8 years',
                    rotationPeriod: '16.1 hours',
                    moons: 14,
                    funFact: 'Neptune\'s winds are the fastest in the solar system, reaching up to 2,100 km/h.'
                },
                'pluto': {
                    name: 'Pluto (Dwarf Planet)',
                    diameter: '2,376 km',
                    mass: '1.303 × 10^22 kg',
                    distanceFromSun: '5.9 billion km (average)',
                    orbitalPeriod: '248.59 years',
                    rotationPeriod: '6.4 days',
                    moons: 5,
                    funFact: 'Pluto was reclassified as a dwarf planet in 2006.'
                }
            };
            
            const planet = planets[planetName];
            
            if (planet) {
                const planetInfo = `*🪐 ${planet.name}*\n\n` +
                    `*Diameter:* ${planet.diameter}\n` +
                    `*Mass:* ${planet.mass}\n` +
                    `*Distance from Sun:* ${planet.distanceFromSun}\n` +
                    `*Orbital Period:* ${planet.orbitalPeriod}\n` +
                    `*Rotation Period:* ${planet.rotationPeriod}\n` +
                    `*Moons:* ${planet.moons}\n\n` +
                    `*Fun Fact:* ${planet.funFact}`;
                
                await safeSendText(sock, remoteJid, planetInfo);
            } else {
                const planetNames = Object.keys(planets).map(name => planets[name].name).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Planet not found*\n\nAvailable planets: ${planetNames}`);
            }
        } catch (err) {
            logger.error('Error in planetsInfo command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving planet information');
        }
    },
    
    async elementInfo(sock, message, args) {
        // Alias for periodic command
        return await this.periodic(sock, message, args);
    },
    
    async statesOfMatter(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const state = args.join(' ').toLowerCase().trim();
            
            if (!state) {
                const statesOverview = `*🧪 States of Matter*\n\n` +
                    `Matter exists primarily in four states:\n\n` +
                    `*1. Solid*\n` +
                    `*2. Liquid*\n` +
                    `*3. Gas*\n` +
                    `*4. Plasma*\n\n` +
                    `Use .statesofmatter [state] to learn more about a specific state.`;
                
                await safeSendText(sock, remoteJid, statesOverview);
                return;
            }
            
            const states = {
                'solid': {
                    name: 'Solid',
                    description: 'In a solid, particles are packed closely together. The forces between particles are strong enough to hold particles together and maintain a fixed shape and volume. Solids have the highest density of the three common states.',
                    examples: 'Ice, rocks, metals, wood',
                    properties: 'Fixed shape, fixed volume, particles vibrate but don\'t move freely'
                },
                'liquid': {
                    name: 'Liquid',
                    description: 'In a liquid, particles are close together but can move around each other. The forces between particles are strong enough to maintain a fixed volume but not a fixed shape. Liquids take the shape of their container.',
                    examples: 'Water, oil, blood, mercury',
                    properties: 'No fixed shape, fixed volume, particles move freely around each other'
                },
                'gas': {
                    name: 'Gas',
                    description: 'In a gas, particles are spread out far from each other with minimal forces between them. A gas has neither a fixed shape nor a fixed volume. The particles move freely and at high speeds.',
                    examples: 'Oxygen, nitrogen, carbon dioxide, steam',
                    properties: 'No fixed shape, no fixed volume, particles move freely and randomly'
                },
                'plasma': {
                    name: 'Plasma',
                    description: 'Plasma is an ionized gas where electrons have been stripped from atoms. It\'s considered the fourth state of matter and is the most common form of ordinary matter in the universe, despite being relatively rare on Earth.',
                    examples: 'Lightning, stars, neon signs, northern lights',
                    properties: 'No fixed shape, electrically conductive, responsive to electromagnetic fields'
                }
            };
            
            const stateInfo = states[state];
            
            if (stateInfo) {
                const infoText = `*🧪 ${stateInfo.name} State of Matter*\n\n` +
                    `*Description:*\n${stateInfo.description}\n\n` +
                    `*Examples:*\n${stateInfo.examples}\n\n` +
                    `*Properties:*\n${stateInfo.properties}`;
                
                await safeSendText(sock, remoteJid, infoText);
            } else {
                await safeSendText(sock, remoteJid, `*❌ Invalid state of matter*\n\nAvailable options: solid, liquid, gas, plasma`);
            }
        } catch (err) {
            logger.error('Error in statesOfMatter command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving states of matter information');
        }
    },
    
    // 8. Math formulas
    async mathFormula(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const formula = args.join(' ').toLowerCase().trim();
            
            if (!formula) {
                const formulaCategories = `*📐 Math Formula Categories*\n\n` +
                    `Available categories:\n` +
                    `• area - Area formulas for shapes\n` +
                    `• volume - Volume formulas for 3D shapes\n` +
                    `• algebra - Common algebraic formulas\n` +
                    `• trigonometry - Trigonometric formulas\n\n` +
                    `Use .mathformula [category] to see formulas in that category.`;
                
                await safeSendText(sock, remoteJid, formulaCategories);
                return;
            }
            
            const formulas = {
                'area': `*📐 Area Formulas*\n\n` +
                    `• Rectangle: A = length × width\n` +
                    `• Square: A = side²\n` +
                    `• Triangle: A = ½ × base × height\n` +
                    `• Circle: A = π × radius²\n` +
                    `• Trapezoid: A = ½ × (a + c) × h\n` +
                    `• Parallelogram: A = base × height\n` +
                    `• Ellipse: A = π × a × b`,
                
                'volume': `*📦 Volume Formulas*\n\n` +
                    `• Cube: V = side³\n` +
                    `• Rectangular Prism: V = length × width × height\n` +
                    `• Sphere: V = (4/3) × π × radius³\n` +
                    `• Cylinder: V = π × radius² × height\n` +
                    `• Cone: V = (1/3) × π × radius² × height\n` +
                    `• Pyramid: V = (1/3) × base area × height`,
                
                'algebra': `*📊 Algebraic Formulas*\n\n` +
                    `• Quadratic Formula: x = (-b ± √(b² - 4ac)) / 2a\n` +
                    `• Binomial Expansion: (a + b)² = a² + 2ab + b²\n` +
                    `• Binomial Expansion: (a - b)² = a² - 2ab + b²\n` +
                    `• Difference of Squares: a² - b² = (a + b)(a - b)\n` +
                    `• Sum of Cubes: a³ + b³ = (a + b)(a² - ab + b²)\n` +
                    `• Difference of Cubes: a³ - b³ = (a - b)(a² + ab + b²)`,
                
                'trigonometry': `*📐 Trigonometric Formulas*\n\n` +
                    `• Pythagorean Identity: sin²θ + cos²θ = 1\n` +
                    `• sin(A + B) = sinA·cosB + cosA·sinB\n` +
                    `• cos(A + B) = cosA·cosB - sinA·sinB\n` +
                    `• sin(2θ) = 2sinθ·cosθ\n` +
                    `• cos(2θ) = cos²θ - sin²θ = 2cos²θ - 1 = 1 - 2sin²θ\n` +
                    `• Law of Sines: a/sinA = b/sinB = c/sinC\n` +
                    `• Law of Cosines: c² = a² + b² - 2ab·cosC`
            };
            
            if (formulas[formula]) {
                await safeSendText(sock, remoteJid, formulas[formula]);
            } else {
                const categories = Object.keys(formulas).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Category not found*\n\nAvailable categories: ${categories}`);
            }
        } catch (err) {
            logger.error('Error in mathFormula command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving math formulas');
        }
    },
    
    async quadratic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .quadratic [a] [b] [c]\nFor equation ax² + bx + c = 0\nExample: .quadratic 1 -3 2');
                return;
            }
            
            const a = parseFloat(args[0]);
            const b = parseFloat(args[1]);
            const c = parseFloat(args[2]);
            
            if (isNaN(a) || isNaN(b) || isNaN(c)) {
                await safeSendText(sock, remoteJid, '*❌ Error:* Please provide valid numeric coefficients');
                return;
            }
            
            if (a === 0) {
                await safeSendText(sock, remoteJid, '*❌ Error:* Coefficient a cannot be zero (not a quadratic equation)');
                return;
            }
            
            // Calculate discriminant
            const discriminant = b*b - 4*a*c;
            
            let resultText = `*🔢 Quadratic Equation Solver*\n\n`;
            resultText += `Equation: ${a}x² + ${b}x + ${c} = 0\n`;
            resultText += `Discriminant: ${discriminant}\n\n`;
            
            if (discriminant > 0) {
                const x1 = (-b + Math.sqrt(discriminant)) / (2*a);
                const x2 = (-b - Math.sqrt(discriminant)) / (2*a);
                resultText += `Two real solutions:\nx₁ = ${x1}\nx₂ = ${x2}`;
            } else if (discriminant === 0) {
                const x = -b / (2*a);
                resultText += `One real solution (double root):\nx = ${x}`;
            } else {
                const realPart = -b / (2*a);
                const imaginaryPart = Math.sqrt(-discriminant) / (2*a);
                resultText += `Two complex solutions:\nx₁ = ${realPart} + ${imaginaryPart}i\nx₂ = ${realPart} - ${imaginaryPart}i`;
            }
            
            await safeSendText(sock, remoteJid, resultText);
        } catch (err) {
            logger.error('Error in quadratic command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error solving quadratic equation');
        }
    },
    
    // 9. General knowledge
    async fact(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            const randomFacts = [
                "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
                "A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once on its axis, and 225 Earth days to orbit the sun.",
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
                "Octopuses have three hearts: two pump blood through the gills, and one pumps it through the body.",
                "The Great Wall of China is not visible from space with the naked eye, contrary to popular belief.",
                "A group of flamingos is called a 'flamboyance'.",
                "Bananas are berries, but strawberries are not botanically berries.",
                "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of the iron.",
                "Cows have best friends and can become stressed when they are separated.",
                "The inventor of the frisbee was cremated and made into frisbees after his death.",
                "The shortest commercial flight in the world is between the islands of Westray and Papa Westray in Scotland, with a flight time of just under 2 minutes.",
                "A bolt of lightning is about 5 times hotter than the surface of the sun.",
                "The Hawaiian alphabet has only 12 letters.",
                "The human nose can detect over 1 trillion different scents.",
                "There are more possible iterations of a game of chess than there are atoms in the observable universe."
            ];
            
            const fact = randomFacts[Math.floor(Math.random() * randomFacts.length)];
            await safeSendText(sock, remoteJid, `*📚 Random Fact*\n\n${fact}`);
        } catch (err) {
            logger.error('Error in fact command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving a random fact');
        }
    },
    
    async historicalEvent(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            // Historical events by date
            const today = new Date();
            const month = today.getMonth(); // 0-11
            const day = today.getDate(); // 1-31
            
            // Events organized by month and day
            const historicalEvents = {
                0: { // January
                    1: "January 1, 1863: The Emancipation Proclamation took effect in the United States.",
                    15: "January 15, 1929: Martin Luther King Jr. was born in Atlanta, Georgia."
                },
                1: { // February
                    11: "February 11, 1990: Nelson Mandela was released from prison after 27 years.",
                    14: "February 14, 1929: The St. Valentine's Day Massacre occurred in Chicago."
                },
                2: { // March
                    14: "March 14, 1879: Albert Einstein was born in Ulm, Germany."
                },
                3: { // April
                    15: "April 15, 1912: The Titanic sank in the North Atlantic Ocean."
                },
                4: { // May
                    8: "May 8, 1945: V-E Day (Victory in Europe Day) marked the end of World War II in Europe."
                },
                5: { // June
                    6: "June 6, 1944: D-Day, the Allied invasion of Normandy, began during World War II."
                },
                6: { // July
                    4: "July 4, 1776: The United States Declaration of Independence was adopted."
                },
                7: { // August
                    6: "August 6, 1945: Atomic bomb was dropped on Hiroshima, Japan."
                },
                8: { // September
                    11: "September 11, 2001: Terrorist attacks occurred at the World Trade Center and Pentagon."
                },
                9: { // October
                    24: "October 24, 1929: The Wall Street Crash began, leading to the Great Depression."
                },
                10: { // November
                    9: "November 9, 1989: The Berlin Wall fell, symbolizing the end of the Cold War."
                },
                11: { // December
                    25: "December 25, 336: The first recorded celebration of Christmas in Rome."
                }
            };
            
            // Get event for today
            const event = historicalEvents[month]?.[day];
            
            if (event) {
                await safeSendText(sock, remoteJid, `*📚 This Day in History*\n\n${event}`);
            } else {
                // If no event for today, provide a random historical event
                const randomEvents = [
                    "July 20, 1969: Apollo 11 landed on the moon, and Neil Armstrong became the first person to walk on the lunar surface.",
                    "December 17, 1903: The Wright brothers made the first controlled, sustained flight of a powered aircraft.",
                    "October 29, 1929: The stock market crashed, marking the beginning of the Great Depression.",
                    "August 15, 1947: India gained independence from British rule.",
                    "November 4, 1922: Howard Carter discovered the entrance to King Tutankhamun's tomb in Egypt.",
                    "June 28, 1914: Archduke Franz Ferdinand was assassinated, triggering the start of World War I.",
                    "October 12, 1492: Christopher Columbus arrived in the Americas.",
                    "April 26, 1986: The Chernobyl nuclear disaster occurred in Ukraine.",
                    "February 7, 1964: The Beatles arrived in the United States for the first time.",
                    "May 10, 1869: The Golden Spike was driven, completing the first transcontinental railroad in the United States."
                ];
                
                const randomEvent = randomEvents[Math.floor(Math.random() * randomEvents.length)];
                await safeSendText(sock, remoteJid, `*📚 Random Historical Event*\n\n${randomEvent}`);
            }
        } catch (err) {
            logger.error('Error in historicalEvent command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving historical event');
        }
    },
    
    async countryInfo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const countryName = args.join(' ').trim();
            
            if (!countryName) {
                await safeSendText(sock, remoteJid, '*🌍 Usage:* .countryinfo [country_name]\nExample: .countryinfo japan');
                return;
            }
            
            await safeSendText(sock, remoteJid, '🔍 Looking up country information...');
            
            try {
                const response = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`);
                
                if (response.data && response.data.length > 0) {
                    const country = response.data[0];
                    
                    // Extract country information
                    const name = country.name.common;
                    const officialName = country.name.official;
                    const capital = country.capital ? country.capital[0] : 'N/A';
                    const region = country.region;
                    const subregion = country.subregion || 'N/A';
                    const population = country.population ? country.population.toLocaleString() : 'N/A';
                    const area = country.area ? `${country.area.toLocaleString()} km²` : 'N/A';
                    const currencies = country.currencies ? Object.values(country.currencies).map(c => `${c.name} (${c.symbol || 'N/A'})`).join(', ') : 'N/A';
                    const languages = country.languages ? Object.values(country.languages).join(', ') : 'N/A';
                    
                    const countryInfo = `*🌍 ${name}*\n` +
                        `*Official Name:* ${officialName}\n` +
                        `*Capital:* ${capital}\n` +
                        `*Region:* ${region}${subregion ? ` (${subregion})` : ''}\n` +
                        `*Population:* ${population}\n` +
                        `*Area:* ${area}\n` +
                        `*Currency:* ${currencies}\n` +
                        `*Languages:* ${languages}`;
                    
                    await safeSendText(sock, remoteJid, countryInfo);
                } else {
                    await safeSendText(sock, remoteJid, `*❌ Country not found*\nCould not find information for "${countryName}".`);
                }
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Error:* Could not retrieve country information. Please check the country name and try again.`);
            }
        } catch (err) {
            logger.error('Error in countryInfo command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving country information');
        }
    },
    
    // 10. Language learning
    async conjugate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            if (args.length < 2) {
                await safeSendText(sock, remoteJid, '*🔤 Usage:* .conjugate [language] [verb]\nExample: .conjugate spanish hablar');
                return;
            }
            
            const language = args[0].toLowerCase();
            const verb = args[1].toLowerCase();
            
            // Spanish verb conjugations (simplified)
            const spanishConjugations = {
                'hablar': {
                    present: {
                        yo: 'hablo',
                        tú: 'hablas',
                        él: 'habla',
                        nosotros: 'hablamos',
                        vosotros: 'habláis',
                        ellos: 'hablan'
                    },
                    past: {
                        yo: 'hablé',
                        tú: 'hablaste',
                        él: 'habló',
                        nosotros: 'hablamos',
                        vosotros: 'hablasteis',
                        ellos: 'hablaron'
                    },
                    future: {
                        yo: 'hablaré',
                        tú: 'hablarás',
                        él: 'hablará',
                        nosotros: 'hablaremos',
                        vosotros: 'hablaréis',
                        ellos: 'hablarán'
                    }
                },
                'comer': {
                    present: {
                        yo: 'como',
                        tú: 'comes',
                        él: 'come',
                        nosotros: 'comemos',
                        vosotros: 'coméis',
                        ellos: 'comen'
                    },
                    past: {
                        yo: 'comí',
                        tú: 'comiste',
                        él: 'comió',
                        nosotros: 'comimos',
                        vosotros: 'comisteis',
                        ellos: 'comieron'
                    },
                    future: {
                        yo: 'comeré',
                        tú: 'comerás',
                        él: 'comerá',
                        nosotros: 'comeremos',
                        vosotros: 'comeréis',
                        ellos: 'comerán'
                    }
                },
                'vivir': {
                    present: {
                        yo: 'vivo',
                        tú: 'vives',
                        él: 'vive',
                        nosotros: 'vivimos',
                        vosotros: 'vivís',
                        ellos: 'viven'
                    },
                    past: {
                        yo: 'viví',
                        tú: 'viviste',
                        él: 'vivió',
                        nosotros: 'vivimos',
                        vosotros: 'vivisteis',
                        ellos: 'vivieron'
                    },
                    future: {
                        yo: 'viviré',
                        tú: 'vivirás',
                        él: 'vivirá',
                        nosotros: 'viviremos',
                        vosotros: 'viviréis',
                        ellos: 'vivirán'
                    }
                }
            };
            
            // French verb conjugations (simplified)
            const frenchConjugations = {
                'parler': {
                    present: {
                        je: 'parle',
                        tu: 'parles',
                        il: 'parle',
                        nous: 'parlons',
                        vous: 'parlez',
                        ils: 'parlent'
                    },
                    past: {
                        je: 'ai parlé',
                        tu: 'as parlé',
                        il: 'a parlé',
                        nous: 'avons parlé',
                        vous: 'avez parlé',
                        ils: 'ont parlé'
                    },
                    future: {
                        je: 'parlerai',
                        tu: 'parleras',
                        il: 'parlera',
                        nous: 'parlerons',
                        vous: 'parlerez',
                        ils: 'parleront'
                    }
                },
                'manger': {
                    present: {
                        je: 'mange',
                        tu: 'manges',
                        il: 'mange',
                        nous: 'mangeons',
                        vous: 'mangez',
                        ils: 'mangent'
                    },
                    past: {
                        je: 'ai mangé',
                        tu: 'as mangé',
                        il: 'a mangé',
                        nous: 'avons mangé',
                        vous: 'avez mangé',
                        ils: 'ont mangé'
                    },
                    future: {
                        je: 'mangerai',
                        tu: 'mangeras',
                        il: 'mangera',
                        nous: 'mangerons',
                        vous: 'mangerez',
                        ils: 'mangeront'
                    }
                }
            };
            
            let conjugations;
            let subjects;
            
            if (language === 'spanish' || language === 'español' || language === 'espanol') {
                conjugations = spanishConjugations[verb];
                subjects = {
                    present: ['yo', 'tú', 'él/ella/usted', 'nosotros/as', 'vosotros/as', 'ellos/ellas/ustedes'],
                    past: ['yo', 'tú', 'él/ella/usted', 'nosotros/as', 'vosotros/as', 'ellos/ellas/ustedes'],
                    future: ['yo', 'tú', 'él/ella/usted', 'nosotros/as', 'vosotros/as', 'ellos/ellas/ustedes']
                };
            } else if (language === 'french' || language === 'français' || language === 'francais') {
                conjugations = frenchConjugations[verb];
                subjects = {
                    present: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'],
                    past: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'],
                    future: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles']
                };
            }
            
            if (conjugations) {
                let result = `*🔤 Conjugation of "${verb}" (${language})*\n\n`;
                
                // Present tense
                result += `*Present Tense:*\n`;
                Object.keys(conjugations.present).forEach((subject, index) => {
                    result += `${subjects.present[index]}: ${conjugations.present[subject]}\n`;
                });
                
                // Past tense
                result += `\n*Past Tense:*\n`;
                Object.keys(conjugations.past).forEach((subject, index) => {
                    result += `${subjects.past[index]}: ${conjugations.past[subject]}\n`;
                });
                
                // Future tense
                result += `\n*Future Tense:*\n`;
                Object.keys(conjugations.future).forEach((subject, index) => {
                    result += `${subjects.future[index]}: ${conjugations.future[subject]}\n`;
                });
                
                await safeSendText(sock, remoteJid, result);
            } else {
                await safeSendText(sock, remoteJid, `*❌ Verb not found*\n\nCould not find conjugations for "${verb}" in ${language}.\n\nCurrently supported languages and verbs:\n- Spanish: hablar, comer, vivir\n- French: parler, manger`);
            }
        } catch (err) {
            logger.error('Error in conjugate command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving verb conjugations');
        }
    },
    
    async capitals(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const country = args.join(' ').toLowerCase().trim();
            
            // If no country specified, provide a random capital
            if (!country) {
                const capitals = {
                    afghanistan: 'Kabul',
                    australia: 'Canberra',
                    brazil: 'Brasília',
                    canada: 'Ottawa',
                    china: 'Beijing',
                    egypt: 'Cairo',
                    france: 'Paris',
                    germany: 'Berlin',
                    india: 'New Delhi',
                    italy: 'Rome',
                    japan: 'Tokyo',
                    mexico: 'Mexico City',
                    russia: 'Moscow',
                    'south africa': 'Pretoria (administrative), Cape Town (legislative), Bloemfontein (judicial)',
                    'united kingdom': 'London',
                    'united states': 'Washington, D.C.'
                };
                
                const countries = Object.keys(capitals);
                const randomCountry = countries[Math.floor(Math.random() * countries.length)];
                const capital = capitals[randomCountry];
                
                await safeSendText(sock, remoteJid, `*🏙️ Capital City*\n\nThe capital of ${randomCountry.charAt(0).toUpperCase() + randomCountry.slice(1)} is ${capital}.\n\nUse .capitals [country] to look up a specific country.`);
                return;
            }
            
            // Look up country based on REST Countries API
            try {
                const response = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`);
                
                if (response.data && response.data.length > 0) {
                    const countryData = response.data[0];
                    const countryName = countryData.name.common;
                    const capital = countryData.capital && countryData.capital.length > 0 ? countryData.capital[0] : 'No official capital';
                    
                    await safeSendText(sock, remoteJid, `*🏙️ Capital City*\n\nThe capital of ${countryName} is ${capital}.`);
                } else {
                    await safeSendText(sock, remoteJid, `*❌ Country not found*\nCould not find information for "${country}".`);
                }
            } catch (error) {
                await safeSendText(sock, remoteJid, `*❌ Error:* Could not retrieve country information. Please check the country name and try again.`);
            }
        } catch (err) {
            logger.error('Error in capitals command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving capital city information');
        }
    },
    
    async currencyInfo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const currencyCode = args[0]?.toUpperCase();
            
            if (!currencyCode) {
                await safeSendText(sock, remoteJid, '*💰 Usage:* .currencyinfo [currency_code]\nExample: .currencyinfo USD');
                return;
            }
            
            // Currency information database
            const currencies = {
                'USD': {
                    name: 'United States Dollar',
                    symbol: '$',
                    countries: 'United States, Ecuador, El Salvador, Panama, and others',
                    notes: 'The world\'s primary reserve currency and the most widely used currency in international transactions.'
                },
                'EUR': {
                    name: 'Euro',
                    symbol: '€',
                    countries: 'Most countries in the European Union including Germany, France, Italy, Spain, etc.',
                    notes: 'The second-largest reserve currency and second-most traded currency in the world after the US dollar.'
                },
                'JPY': {
                    name: 'Japanese Yen',
                    symbol: '¥',
                    countries: 'Japan',
                    notes: 'The third-most traded currency in the foreign exchange market after the US dollar and the Euro.'
                },
                'GBP': {
                    name: 'British Pound Sterling',
                    symbol: '£',
                    countries: 'United Kingdom',
                    notes: 'The oldest currency still in use and the fourth-most traded in the foreign exchange market.'
                },
                'AUD': {
                    name: 'Australian Dollar',
                    symbol: 'A$',
                    countries: 'Australia, Christmas Island, Cocos Islands, Nauru, Tuvalu',
                    notes: 'The fifth-most traded currency in the world foreign exchange markets.'
                },
                'CAD': {
                    name: 'Canadian Dollar',
                    symbol: 'C$',
                    countries: 'Canada',
                    notes: 'Often called the "loonie" after the image of a loon on the $1 coin.'
                },
                'CHF': {
                    name: 'Swiss Franc',
                    symbol: 'Fr',
                    countries: 'Switzerland, Liechtenstein',
                    notes: 'Considered a safe-haven currency due to Switzerland\'s neutral status and strong economy.'
                },
                'CNY': {
                    name: 'Chinese Yuan Renminbi',
                    symbol: '¥',
                    countries: 'China',
                    notes: 'The official currency of the People\'s Republic of China.'
                },
                'INR': {
                    name: 'Indian Rupee',
                    symbol: '₹',
                    countries: 'India',
                    notes: 'The Indian rupee sign ₹ was officially adopted in 2010.'
                }
            };
            
            const currency = currencies[currencyCode];
            
            if (currency) {
                const info = `*💰 ${currency.name} (${currencyCode})*\n\n` +
                    `*Symbol:* ${currency.symbol}\n` +
                    `*Used in:* ${currency.countries}\n` +
                    `*Notes:* ${currency.notes}`;
                
                await safeSendText(sock, remoteJid, info);
            } else {
                const supportedCurrencies = Object.keys(currencies).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Currency not found*\n\nSupported currencies: ${supportedCurrencies}`);
            }
        } catch (err) {
            logger.error('Error in currencyInfo command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving currency information');
        }
    },
    
    // 11. Literature and writing
    async grammar(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const topic = args.join(' ').toLowerCase().trim();
            
            const grammarTopics = {
                'comma': `*Comma Usage*\n\n` +
                    `Commas are used to separate elements in a series, set off introductory words, separate independent clauses, and set off nonrestrictive clauses.\n\n` +
                    `Examples:\n` +
                    `• Series: I bought apples, oranges, and bananas.\n` +
                    `• Introductory: After the movie, we went for dinner.\n` +
                    `• Independent clauses: She was tired, so she went to bed early.\n` +
                    `• Nonrestrictive: My brother, who lives in London, is visiting next week.`,
                
                'semicolon': `*Semicolon Usage*\n\n` +
                    `Semicolons connect closely related independent clauses and separate items in complex lists.\n\n` +
                    `Examples:\n` +
                    `• Between clauses: She didn't want to go; she was too tired.\n` +
                    `• In complex lists: We visited Paris, France; Rome, Italy; and Madrid, Spain.`,
                
                'colon': `*Colon Usage*\n\n` +
                    `Colons introduce lists, explanations, or definitions. They can also separate hours from minutes and in certain titles.\n\n` +
                    `Examples:\n` +
                    `• Lists: We need three items: flour, sugar, and butter.\n` +
                    `• Explanations: There's only one solution: we must leave immediately.\n` +
                    `• Time: The meeting starts at 10:30 AM.`,
                
                'apostrophe': `*Apostrophe Usage*\n\n` +
                    `Apostrophes show possession and mark omissions in contractions.\n\n` +
                    `Examples:\n` +
                    `• Possession: Sam's car, the children's toys\n` +
                    `• Contractions: don't (do not), it's (it is), who's (who is)\n` +
                    `• Note: "its" (possessive) vs. "it's" (contraction of "it is")`,
                
                'who vs whom': `*Who vs. Whom*\n\n` +
                    `"Who" is used as the subject of a verb, while "whom" is used as the object of a verb or preposition.\n\n` +
                    `Examples:\n` +
                    `• Who: Who wrote this letter? (subject)\n` +
                    `• Whom: To whom should I address this letter? (object of preposition)\n\n` +
                    `Quick tip: If you can replace it with "he/she/they," use "who." If you can replace it with "him/her/them," use "whom."`,
                
                'affect vs effect': `*Affect vs. Effect*\n\n` +
                    `"Affect" is usually a verb meaning "to influence," while "effect" is usually a noun meaning "result."\n\n` +
                    `Examples:\n` +
                    `• Affect (verb): The weather affects my mood.\n` +
                    `• Effect (noun): The effect of the medicine was immediate.\n\n` +
                    `Exceptions: "Effect" can sometimes be a verb meaning "to bring about" and "affect" can sometimes be a noun referring to emotional expression.`
            };
            
            if (!topic) {
                const topics = Object.keys(grammarTopics).join(', ');
                await safeSendText(sock, remoteJid, `*📝 Grammar Topics*\n\nAvailable topics: ${topics}\n\nUse .grammar [topic] to learn about a specific grammar topic.`);
                return;
            }
            
            // Check for specific topics
            const matchingTopic = Object.keys(grammarTopics).find(key => topic.includes(key));
            
            if (matchingTopic) {
                await safeSendText(sock, remoteJid, grammarTopics[matchingTopic]);
            } else {
                const topics = Object.keys(grammarTopics).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Grammar topic not found*\n\nAvailable topics: ${topics}`);
            }
        } catch (err) {
            logger.error('Error in grammar command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving grammar information');
        }
    },
    
    async quote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            const quotes = [
                {
                    text: "The only way to do great work is to love what you do.",
                    author: "Steve Jobs"
                },
                {
                    text: "In three words I can sum up everything I've learned about life: it goes on.",
                    author: "Robert Frost"
                },
                {
                    text: "The future belongs to those who believe in the beauty of their dreams.",
                    author: "Eleanor Roosevelt"
                },
                {
                    text: "Be yourself; everyone else is already taken.",
                    author: "Oscar Wilde"
                },
                {
                    text: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.",
                    author: "Albert Einstein"
                },
                {
                    text: "The only impossible journey is the one you never begin.",
                    author: "Tony Robbins"
                },
                {
                    text: "The purpose of our lives is to be happy.",
                    author: "Dalai Lama"
                },
                {
                    text: "You have within you right now, everything you need to deal with whatever the world can throw at you.",
                    author: "Brian Tracy"
                },
                {
                    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
                    author: "Chinese Proverb"
                },
                {
                    text: "Happiness is not something ready-made. It comes from your own actions.",
                    author: "Dalai Lama"
                }
            ];
            
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await safeSendText(sock, remoteJid, `*📜 Quote*\n\n"${randomQuote.text}"\n\n— ${randomQuote.author}`);
        } catch (err) {
            logger.error('Error in quote command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving quote');
        }
    },
    
    // 12. Educational tools
    async times(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const number = parseInt(args[0]);
            
            if (isNaN(number) || number < 1 || number > 20) {
                await safeSendText(sock, remoteJid, '*🔢 Usage:* .times [number]\nProvide a number between 1 and 20 to get its multiplication table.');
                return;
            }
            
            let table = `*🔢 ${number} Times Table*\n\n`;
            
            for (let i = 1; i <= 12; i++) {
                table += `${number} × ${i} = ${number * i}\n`;
            }
            
            await safeSendText(sock, remoteJid, table);
        } catch (err) {
            logger.error('Error in times command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error generating multiplication table');
        }
    },
    
    async worldTime(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const city = args.join(' ').trim();
            
            if (!city) {
                // Show current time in major cities
                const now = new Date();
                
                const cities = [
                    { name: 'New York', offset: -4 }, // EDT
                    { name: 'London', offset: 1 }, // BST
                    { name: 'Paris', offset: 2 }, // CEST
                    { name: 'Tokyo', offset: 9 }, // JST
                    { name: 'Sydney', offset: 10 } // AEST
                ];
                
                let timeInfo = `*🌐 World Time*\n\n`;
                
                cities.forEach(({ name, offset }) => {
                    const cityTime = new Date(now.getTime() + (offset * 60 - now.getTimezoneOffset()) * 60000);
                    timeInfo += `${name}: ${cityTime.toLocaleTimeString()} (UTC${offset >= 0 ? '+' : ''}${offset})\n`;
                });
                
                timeInfo += `\nUse .worldtime [city] to check time in a specific city.`;
                
                await safeSendText(sock, remoteJid, timeInfo);
                return;
            }
            
            await safeSendText(sock, remoteJid, `*⏰ Time Zone Information*\n\nThe current time in major cities functionality is provided by default.\n\nFor specific city lookups, please use .worldtime without a city name to see the current time in major cities.`);
        } catch (err) {
            logger.error('Error in worldTime command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving world time information');
        }
    },
    
    // 13. Science and Technology
    async scientificFact(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            const scientificFacts = [
                "DNA, or deoxyribonucleic acid, can be stretched from Earth to the Sun and back more than 600 times.",
                "The human body contains enough carbon to make about 900 pencils.",
                "There are more possible iterations of a game of chess than there are atoms in the observable universe.",
                "Light takes 8 minutes and 20 seconds to travel from the Sun to Earth.",
                "One teaspoon of a neutron star would weigh about 6 billion tons.",
                "Hawaii moves 7.5 cm closer to Alaska every year due to plate tectonics.",
                "There are more bacteria in your mouth than there are people in the world.",
                "The average human body contains enough iron to make a 3-inch nail.",
                "If you could fold a piece of paper 42 times, it would reach the moon.",
                "A day on Venus is longer than a year on Venus.",
                "The Great Barrier Reef is the largest living structure on Earth.",
                "A thimbleful of a neutron star would weigh more than 100 million tons.",
                "Water can exist in three states at once - this is known as the triple point.",
                "A bolt of lightning is five times hotter than the surface of the sun.",
                "Human DNA is 99.9% identical from person to person."
            ];
            
            const fact = scientificFacts[Math.floor(Math.random() * scientificFacts.length)];
            await safeSendText(sock, remoteJid, `*🔬 Scientific Fact*\n\n${fact}`);
        } catch (err) {
            logger.error('Error in scientificFact command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving scientific fact');
        }
    },
    
    async animal(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const animalName = args.join(' ').toLowerCase().trim();
            
            if (!animalName) {
                await safeSendText(sock, remoteJid, '*🐾 Usage:* .animal [animal_name]\nExample: .animal elephant');
                return;
            }
            
            // Animal information database
            const animals = {
                'elephant': {
                    name: 'Elephant',
                    scientificName: 'Elephantidae',
                    diet: 'Herbivore',
                    habitat: 'Forests, savannas, and deserts of Africa and Asia',
                    lifespan: '60-70 years',
                    weight: 'African: 4,000-7,000 kg; Asian: 3,000-6,000 kg',
                    fact: 'Elephants are the largest land animals on Earth. They have excellent memory and can remember specific individuals and places for many years.'
                },
                'lion': {
                    name: 'Lion',
                    scientificName: 'Panthera leo',
                    diet: 'Carnivore',
                    habitat: 'Grasslands and savannas of sub-Saharan Africa',
                    lifespan: '10-14 years in the wild; up to 20 in captivity',
                    weight: 'Males: 150-250 kg; Females: 120-182 kg',
                    fact: 'Lions are the only cats that live in groups called prides. Male lions have distinctive manes that darken with age.'
                },
                'dolphin': {
                    name: 'Dolphin',
                    scientificName: 'Delphinidae',
                    diet: 'Carnivore (fish, squid, crustaceans)',
                    habitat: 'Oceans and seas worldwide; some species in rivers',
                    lifespan: '20-30 years depending on species',
                    weight: '150-300 kg for common bottlenose dolphins',
                    fact: 'Dolphins are among the most intelligent animals on Earth. They use echolocation to find prey and navigate by emitting clicking sounds and listening for the echoes.'
                },
                'eagle': {
                    name: 'Eagle',
                    scientificName: 'Accipitridae',
                    diet: 'Carnivore',
                    habitat: 'Mountains, forests, plains, and coastal areas worldwide',
                    lifespan: '20-30 years in the wild',
                    weight: '3-6.5 kg depending on species',
                    fact: 'Eagles have exceptional vision, allowing them to spot prey from up to 2 miles away. They can fly at speeds up to 200 km/h when diving.'
                },
                'octopus': {
                    name: 'Octopus',
                    scientificName: 'Octopoda',
                    diet: 'Carnivore (crustaceans, fish, other mollusks)',
                    habitat: 'Oceans worldwide, especially coral reefs and sea floor',
                    lifespan: '1-5 years depending on species',
                    weight: '3-10 kg for common species',
                    fact: 'Octopuses have three hearts, blue blood, and can change color instantly to match their surroundings. They are considered the most intelligent invertebrates.'
                }
            };
            
            const animal = animals[animalName];
            
            if (animal) {
                const info = `*🐾 ${animal.name}*\n\n` +
                    `*Scientific Name:* ${animal.scientificName}\n` +
                    `*Diet:* ${animal.diet}\n` +
                    `*Habitat:* ${animal.habitat}\n` +
                    `*Lifespan:* ${animal.lifespan}\n` +
                    `*Weight:* ${animal.weight}\n\n` +
                    `*Interesting Fact:* ${animal.fact}`;
                
                await safeSendText(sock, remoteJid, info);
            } else {
                const availableAnimals = Object.keys(animals).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Animal not found*\n\nAvailable animals: ${availableAnimals}`);
            }
        } catch (err) {
            logger.error('Error in animal command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving animal information');
        }
    },
    
    async constellation(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const constellationName = args.join(' ').toLowerCase().trim();
            
            if (!constellationName) {
                await safeSendText(sock, remoteJid, '*✨ Usage:* .constellation [constellation_name]\nExample: .constellation orion');
                return;
            }
            
            // Constellation database
            const constellations = {
                'orion': {
                    name: 'Orion',
                    meaning: 'The Hunter',
                    season: 'Winter (Northern Hemisphere)',
                    mainStars: 'Betelgeuse, Rigel, Bellatrix, Mintaka, Alnilam, Alnitak, Saiph',
                    description: 'One of the most recognizable constellations, featuring a distinctive "belt" of three stars. Named after a hunter in Greek mythology.'
                },
                'ursa major': {
                    name: 'Ursa Major',
                    meaning: 'Great Bear',
                    season: 'Visible year-round in Northern Hemisphere',
                    mainStars: 'Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid',
                    description: 'Contains the Big Dipper asterism. The two stars Dubhe and Merak are known as "pointer stars" because they point toward Polaris (North Star).'
                },
                'cassiopeia': {
                    name: 'Cassiopeia',
                    meaning: 'Queen of Ethiopia (Greek mythology)',
                    season: 'Visible year-round in Northern Hemisphere',
                    mainStars: 'Schedar, Caph, Gamma Cassiopeiae, Ruchbah, Segin',
                    description: 'Easily recognized by its distinctive W or M shape, depending on its orientation. Named after a vain queen in Greek mythology.'
                },
                'leo': {
                    name: 'Leo',
                    meaning: 'The Lion',
                    season: 'Spring (Northern Hemisphere)',
                    mainStars: 'Regulus, Denebola, Algieba, Zosma, Chort',
                    description: 'Represents the Nemean Lion from Greek mythology, which was killed by Heracles. Regulus, its brightest star, is known as the "Heart of the Lion."'
                },
                'scorpius': {
                    name: 'Scorpius',
                    meaning: 'The Scorpion',
                    season: 'Summer (Northern Hemisphere)',
                    mainStars: 'Antares, Shaula, Sargas, Dschubba, Acrab',
                    description: 'One of the few constellations that resembles what it\'s named after. Antares, its brightest star, has a reddish hue and is known as the "heart of the scorpion."'
                }
            };
            
            const constellation = constellations[constellationName];
            
            if (constellation) {
                const info = `*✨ ${constellation.name} Constellation*\n\n` +
                    `*Meaning:* ${constellation.meaning}\n` +
                    `*Best Viewed:* ${constellation.season}\n` +
                    `*Main Stars:* ${constellation.mainStars}\n\n` +
                    `*Description:* ${constellation.description}`;
                
                await safeSendText(sock, remoteJid, info);
            } else {
                const availableConstellations = Object.keys(constellations).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Constellation not found*\n\nAvailable constellations: ${availableConstellations}`);
            }
        } catch (err) {
            logger.error('Error in constellation command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving constellation information');
        }
    },
    
    async science(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const topic = args.join(' ').toLowerCase().trim();
            
            if (!topic) {
                const scienceTopics = `*🔬 Science Topics*\n\n` +
                    `Available topics:\n` +
                    `• astronomy - Information about space and celestial bodies\n` +
                    `• biology - Study of living organisms\n` +
                    `• chemistry - Study of matter and its properties\n` +
                    `• physics - Study of matter, energy, and their interactions\n` +
                    `• geology - Study of the Earth's structure\n\n` +
                    `Use .science [topic] to learn about a specific topic.`;
                
                await safeSendText(sock, remoteJid, scienceTopics);
                return;
            }
            
            const scienceInfo = {
                'astronomy': `*🔭 Astronomy*\n\n` +
                    `Astronomy is the study of celestial objects, space, and the physical universe as a whole. It includes the observation of stars, planets, moons, comets, galaxies, and phenomena originating outside Earth's atmosphere.\n\n` +
                    `*Key Concepts:*\n` +
                    `• The universe is approximately 13.8 billion years old\n` +
                    `• Our solar system contains 8 planets orbiting the Sun\n` +
                    `• The Milky Way galaxy contains 100-400 billion stars\n` +
                    `• Light from the nearest star (Proxima Centauri) takes 4.24 years to reach Earth`,
                
                'biology': `*🧬 Biology*\n\n` +
                    `Biology is the natural science that studies life and living organisms, including their physical structure, chemical processes, molecular interactions, and development.\n\n` +
                    `*Key Concepts:*\n` +
                    `• Cell theory: All living things are composed of cells\n` +
                    `• Evolution: Organisms change over time through natural selection\n` +
                    `• Genetics: Traits are passed from parents to offspring\n` +
                    `• Homeostasis: Living organisms maintain internal stability`,
                
                'chemistry': `*⚗️ Chemistry*\n\n` +
                    `Chemistry is the scientific study of the properties, composition, and structure of matter, the changes it undergoes, and the energy released or absorbed during these changes.\n\n` +
                    `*Key Concepts:*\n` +
                    `• Atoms are the basic units of matter\n` +
                    `• The periodic table organizes elements by their properties\n` +
                    `• Chemical bonds (ionic, covalent, metallic) hold atoms together\n` +
                    `• Chemical reactions involve the rearrangement of atoms`,
                
                'physics': `*⚛️ Physics*\n\n` +
                    `Physics is the natural science that studies matter, its motion and behavior through space and time, and the related entities of energy and force.\n\n` +
                    `*Key Concepts:*\n` +
                    `• Newton's laws of motion describe the relationship between objects and forces\n` +
                    `• Einstein's theory of relativity links space, time, and gravity\n` +
                    `• Quantum mechanics describes behavior at atomic and subatomic scales\n` +
                    `• Thermodynamics deals with heat, work, and energy`,
                
                'geology': `*🌋 Geology*\n\n` +
                    `Geology is the study of the Earth, the materials of which it is made, the structure of those materials, and the processes acting upon them.\n\n` +
                    `*Key Concepts:*\n` +
                    `• The Earth is composed of multiple layers (crust, mantle, core)\n` +
                    `• Plate tectonics explains the movement of Earth's crust\n` +
                    `• Rocks are classified as igneous, sedimentary, or metamorphic\n` +
                    `• Fossils provide evidence of past life and environments`
            };
            
            if (scienceInfo[topic]) {
                await safeSendText(sock, remoteJid, scienceInfo[topic]);
            } else {
                const availableTopics = Object.keys(scienceInfo).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Topic not found*\n\nAvailable topics: ${availableTopics}`);
            }
        } catch (err) {
            logger.error('Error in science command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving science information');
        }
    },
    
    // 14. History and Geography
    async historicalPeriod(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const period = args.join(' ').toLowerCase().trim();
            
            if (!period) {
                const periods = `*📜 Historical Periods*\n\n` +
                    `Available periods:\n` +
                    `• ancient egypt\n` +
                    `• ancient greece\n` +
                    `• roman empire\n` +
                    `• middle ages\n` +
                    `• renaissance\n` +
                    `• industrial revolution\n` +
                    `• world war 2\n\n` +
                    `Use .historicalperiod [period] to learn about a specific period.`;
                
                await safeSendText(sock, remoteJid, periods);
                return;
            }
            
            const historicalInfo = {
                'ancient egypt': `*🏺 Ancient Egypt (3100-332 BCE)*\n\n` +
                    `Ancient Egypt was one of the earliest and longest-lasting civilizations, known for its monumental architecture, art, and religious beliefs.\n\n` +
                    `*Key Features:*\n` +
                    `• Ruled by pharaohs, considered living gods\n` +
                    `• Built pyramids as tombs for pharaohs\n` +
                    `• Developed hieroglyphic writing system\n` +
                    `• Advanced knowledge of mathematics, astronomy, and medicine\n` +
                    `• Complex religious system with many gods`,
                
                'ancient greece': `*🏛️ Ancient Greece (800-146 BCE)*\n\n` +
                    `Ancient Greece is considered the birthplace of Western civilization, with significant contributions to philosophy, democracy, arts, and sciences.\n\n` +
                    `*Key Features:*\n` +
                    `• Organized in city-states (poleis), with Athens and Sparta being the most prominent\n` +
                    `• Developed early democratic systems in Athens\n` +
                    `• Produced influential philosophers like Socrates, Plato, and Aristotle\n` +
                    `• Created classical architecture and sculpture\n` +
                    `• Held the first Olympic Games`,
                
                'roman empire': `*🏛️ Roman Empire (27 BCE-476 CE)*\n\n` +
                    `The Roman Empire was one of the largest empires in ancient history, known for its governance, architecture, engineering, and military prowess.\n\n` +
                    `*Key Features:*\n` +
                    `• Evolved from the Roman Republic after Julius Caesar\n` +
                    `• At its height, controlled territories across Europe, North Africa, and Western Asia\n` +
                    `• Built extensive road networks, aqueducts, and monumental architecture\n` +
                    `• Developed a legal system that influenced modern law\n` +
                    `• Eventually split into Western and Eastern (Byzantine) empires`,
                
                'middle ages': `*🏰 Middle Ages (476-1453 CE)*\n\n` +
                    `The Middle Ages, or Medieval Period, followed the fall of the Western Roman Empire and preceded the Renaissance, characterized by feudalism and the rise of Christianity.\n\n` +
                    `*Key Features:*\n` +
                    `• Feudal system organized society into lords and vassals\n` +
                    `• Catholic Church became a dominant institution\n` +
                    `• Built magnificent Gothic cathedrals\n` +
                    `• Crusades attempted to reclaim Holy Land\n` +
                    `• Black Death pandemic devastated Europe`,
                
                'renaissance': `*🎭 Renaissance (14th-17th centuries)*\n\n` +
                    `The Renaissance was a period of cultural, artistic, political, and economic "rebirth" that bridged the Middle Ages and Modern History.\n\n` +
                    `*Key Features:*\n` +
                    `• Renewed interest in classical Greek and Roman culture\n` +
                    `• Promoted humanism, focusing on human potential and achievement\n` +
                    `• Major artistic innovations by figures like Leonardo da Vinci and Michelangelo\n` +
                    `• Scientific advancements by Galileo, Copernicus, and others\n` +
                    `• Invention of the printing press spread knowledge widely`,
                
                'industrial revolution': `*🏭 Industrial Revolution (1760-1840)*\n\n` +
                    `The Industrial Revolution marked a major turning point in history, with a transition from hand production to machine manufacturing.\n\n` +
                    `*Key Features:*\n` +
                    `• Began in Great Britain and spread to Europe and North America\n` +
                    `• Saw the development of steam power and mechanized factory systems\n` +
                    `• Led to rapid urbanization as people moved to cities for factory work\n` +
                    `• Created new social classes and labor movements\n` +
                    `• Dramatically increased production capabilities and global trade`,
                
                'world war 2': `*🪖 World War II (1939-1945)*\n\n` +
                    `World War II was a global conflict that involved most of the world's nations, forming two opposing military alliances: the Allies and the Axis.\n\n` +
                    `*Key Features:*\n` +
                    `• Caused by the rise of fascism, economic instability, and unresolved tensions from WWI\n` +
                    `• Allied Powers (UK, US, USSR, etc.) fought against Axis Powers (Germany, Italy, Japan)\n` +
                    `• Holocaust resulted in the genocide of 6 million Jews and millions of others\n` +
                    `• Ended with the unconditional surrender of the Axis powers\n` +
                    `• Led to the formation of the United Nations and the beginning of the Cold War`
            };
            
            // Check if period exists in our database
            let matchedPeriod = null;
            for (const key of Object.keys(historicalInfo)) {
                if (period.includes(key) || key.includes(period)) {
                    matchedPeriod = key;
                    break;
                }
            }
            
            if (matchedPeriod) {
                await safeSendText(sock, remoteJid, historicalInfo[matchedPeriod]);
            } else {
                const availablePeriods = Object.keys(historicalInfo).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Period not found*\n\nAvailable periods: ${availablePeriods}`);
            }
        } catch (err) {
            logger.error('Error in historicalPeriod command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving historical period information');
        }
    },
    
    async continent(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const continentName = args.join(' ').toLowerCase().trim();
            
            if (!continentName) {
                await safeSendText(sock, remoteJid, '*🌍 Usage:* .continent [continent_name]\nExample: .continent asia');
                return;
            }
            
            // Continent information
            const continents = {
                'africa': {
                    name: 'Africa',
                    area: '30.37 million km²',
                    population: 'Approximately 1.4 billion',
                    countries: '54',
                    largestCountry: 'Algeria (by area), Nigeria (by population)',
                    description: 'Africa is the second-largest and second-most populous continent. It is known for its diverse cultures, wildlife, and the Sahara Desert, the largest hot desert in the world. The continent is home to the world\'s longest river, the Nile.'
                },
                'asia': {
                    name: 'Asia',
                    area: '44.58 million km²',
                    population: 'Approximately 4.7 billion',
                    countries: '48',
                    largestCountry: 'Russia (by area), China (by population)',
                    description: 'Asia is the largest and most populous continent, containing about 60% of the world\'s population. It features diverse landscapes from the Himalayan mountains to tropical rainforests, and has been the birthplace of many major civilizations and religions.'
                },
                'europe': {
                    name: 'Europe',
                    area: '10.18 million km²',
                    population: 'Approximately 750 million',
                    countries: '44',
                    largestCountry: 'Russia (by area), Russia (by population)',
                    description: 'Europe is the sixth-largest continent, known for its rich history, cultural heritage, and diverse political systems. It has been a center of art, science, and philosophy, and played a major role in global affairs through colonization and industrialization.'
                },
                'north america': {
                    name: 'North America',
                    area: '24.71 million km²',
                    population: 'Approximately 600 million',
                    countries: '23',
                    largestCountry: 'Canada (by area), United States (by population)',
                    description: 'North America is the third-largest continent, stretching from the Arctic Circle to the tropics. It includes diverse ecosystems from Arctic tundra to tropical rainforests, and has been home to indigenous peoples for thousands of years before European colonization.'
                },
                'south america': {
                    name: 'South America',
                    area: '17.84 million km²',
                    population: 'Approximately 430 million',
                    countries: '12',
                    largestCountry: 'Brazil (by area and population)',
                    description: 'South America is the fourth-largest continent, known for the Amazon Rainforest, the Andes Mountains, and diverse cultures. It is home to incredible biodiversity and important ancient civilizations like the Inca, Maya, and Aztec.'
                },
                'australia': {
                    name: 'Australia/Oceania',
                    area: '8.53 million km²',
                    population: 'Approximately 43 million',
                    countries: '14',
                    largestCountry: 'Australia (by area and population)',
                    description: 'Oceania is the smallest continent, consisting of Australia and numerous Pacific islands. It features unique wildlife and ecosystems, including the Great Barrier Reef, and diverse indigenous cultures with rich traditions and histories.'
                },
                'antarctica': {
                    name: 'Antarctica',
                    area: '14.2 million km²',
                    population: 'No permanent population (1,000-5,000 researchers seasonally)',
                    countries: '0 (governed by Antarctic Treaty)',
                    largestCountry: 'N/A',
                    description: 'Antarctica is the southernmost and fifth-largest continent, almost entirely covered by ice sheets. It is the coldest, driest, and windiest continent, and has no native human population. It is primarily used for scientific research and is protected by international treaties.'
                }
            };
            
            let matchedContinent = null;
            for (const key of Object.keys(continents)) {
                if (continentName === key || key.includes(continentName)) {
                    matchedContinent = key;
                    break;
                }
            }
            
            if (matchedContinent) {
                const continent = continents[matchedContinent];
                const info = `*🌍 ${continent.name}*\n\n` +
                    `*Area:* ${continent.area}\n` +
                    `*Population:* ${continent.population}\n` +
                    `*Number of Countries:* ${continent.countries}\n` +
                    `*Largest Country:* ${continent.largestCountry}\n\n` +
                    `*Description:* ${continent.description}`;
                
                await safeSendText(sock, remoteJid, info);
            } else {
                const availableContinents = Object.keys(continents).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Continent not found*\n\nAvailable continents: ${availableContinents}`);
            }
        } catch (err) {
            logger.error('Error in continent command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving continent information');
        }
    },
    
    // 15. Language and Writing
    async synonym(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ').toLowerCase().trim();
            
            if (!word) {
                await safeSendText(sock, remoteJid, '*📝 Usage:* .synonym [word]\nExample: .synonym happy');
                return;
            }
            
            // Dictionary of synonyms
            const synonyms = {
                'happy': ['joyful', 'content', 'pleased', 'delighted', 'cheerful', 'merry', 'jubilant', 'ecstatic'],
                'sad': ['unhappy', 'sorrowful', 'depressed', 'downcast', 'miserable', 'gloomy', 'melancholy', 'despondent'],
                'big': ['large', 'huge', 'enormous', 'gigantic', 'massive', 'substantial', 'immense', 'colossal'],
                'small': ['tiny', 'little', 'miniature', 'compact', 'diminutive', 'petite', 'minute', 'microscopic'],
                'good': ['excellent', 'fine', 'superb', 'outstanding', 'wonderful', 'great', 'superior', 'admirable'],
                'bad': ['poor', 'awful', 'terrible', 'horrible', 'atrocious', 'dreadful', 'inferior', 'substandard'],
                'beautiful': ['attractive', 'pretty', 'lovely', 'stunning', 'gorgeous', 'handsome', 'elegant', 'exquisite'],
                'ugly': ['unattractive', 'plain', 'unsightly', 'hideous', 'unpleasant', 'homely', 'grotesque', 'repulsive'],
                'smart': ['intelligent', 'clever', 'bright', 'brilliant', 'wise', 'astute', 'shrewd', 'knowledgeable'],
                'stupid': ['foolish', 'dumb', 'dense', 'slow', 'simple-minded', 'unwise', 'unintelligent', 'brainless']
            };
            
            if (synonyms[word]) {
                await safeSendText(sock, remoteJid, `*📝 Synonyms for "${word}"*\n\n${synonyms[word].join(', ')}`);
            } else {
                await safeSendText(sock, remoteJid, `*❌ No synonyms found*\n\nNo synonyms available for "${word}". Try another word.`);
            }
        } catch (err) {
            logger.error('Error in synonym command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving synonyms');
        }
    },
    
    async antonym(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ').toLowerCase().trim();
            
            if (!word) {
                await safeSendText(sock, remoteJid, '*📝 Usage:* .antonym [word]\nExample: .antonym hot');
                return;
            }
            
            // Dictionary of antonyms
            const antonyms = {
                'hot': ['cold', 'cool', 'chilly', 'frigid'],
                'cold': ['hot', 'warm', 'heated', 'burning'],
                'happy': ['sad', 'unhappy', 'miserable', 'depressed'],
                'sad': ['happy', 'joyful', 'cheerful', 'delighted'],
                'big': ['small', 'tiny', 'little', 'miniature'],
                'small': ['big', 'large', 'huge', 'enormous'],
                'good': ['bad', 'poor', 'inferior', 'substandard'],
                'bad': ['good', 'excellent', 'superior', 'quality'],
                'beautiful': ['ugly', 'unattractive', 'plain', 'homely'],
                'ugly': ['beautiful', 'attractive', 'pretty', 'handsome'],
                'smart': ['stupid', 'unintelligent', 'foolish', 'simple-minded'],
                'stupid': ['smart', 'intelligent', 'clever', 'bright'],
                'fast': ['slow', 'sluggish', 'leisurely', 'unhurried'],
                'slow': ['fast', 'quick', 'rapid', 'swift'],
                'love': ['hate', 'loathe', 'detest', 'abhor'],
                'hate': ['love', 'adore', 'cherish', 'worship']
            };
            
            if (antonyms[word]) {
                await safeSendText(sock, remoteJid, `*📝 Antonyms for "${word}"*\n\n${antonyms[word].join(', ')}`);
            } else {
                await safeSendText(sock, remoteJid, `*❌ No antonyms found*\n\nNo antonyms available for "${word}". Try another word.`);
            }
        } catch (err) {
            logger.error('Error in antonym command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving antonyms');
        }
    },
    
    async idiom(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const idiomName = args.join(' ').toLowerCase().trim();
            
            if (!idiomName) {
                // Provide a random idiom if none specified
                const idioms = [
                    {
                        idiom: "Break a leg",
                        meaning: "Good luck (often said to performers before they go on stage)",
                        example: "You have an interview tomorrow? Break a leg!"
                    },
                    {
                        idiom: "Bite the bullet",
                        meaning: "To face a difficult situation with courage",
                        example: "I don't want to go to the dentist, but I'll bite the bullet and go anyway."
                    },
                    {
                        idiom: "Cost an arm and a leg",
                        meaning: "To be very expensive",
                        example: "That new smartphone costs an arm and a leg."
                    },
                    {
                        idiom: "Hit the nail on the head",
                        meaning: "To describe exactly what is causing a situation or problem",
                        example: "You hit the nail on the head when you said she's jealous of your success."
                    },
                    {
                        idiom: "Under the weather",
                        meaning: "Feeling ill",
                        example: "I'm feeling a bit under the weather today, so I'm staying home."
                    },
                    {
                        idiom: "Once in a blue moon",
                        meaning: "Very rarely",
                        example: "I only eat at expensive restaurants once in a blue moon."
                    },
                    {
                        idiom: "Piece of cake",
                        meaning: "Something very easy to do",
                        example: "The exam was a piece of cake - I finished it in half the time."
                    },
                    {
                        idiom: "Spill the beans",
                        meaning: "To reveal a secret",
                        example: "Come on, spill the beans about your date last night!"
                    }
                ];
                
                const randomIdiom = idioms[Math.floor(Math.random() * idioms.length)];
                await safeSendText(sock, remoteJid, `*📝 Idiom*\n\n*${randomIdiom.idiom}*\n\n*Meaning:* ${randomIdiom.meaning}\n\n*Example:* ${randomIdiom.example}\n\nUse .idiom [name] to look up a specific idiom.`);
                return;
            }
            
            // Dictionary of idioms
            const idioms = {
                'break a leg': {
                    idiom: "Break a leg",
                    meaning: "Good luck (often said to performers before they go on stage)",
                    example: "You have an interview tomorrow? Break a leg!"
                },
                'bite the bullet': {
                    idiom: "Bite the bullet",
                    meaning: "To face a difficult situation with courage",
                    example: "I don't want to go to the dentist, but I'll bite the bullet and go anyway."
                },
                'cost an arm and a leg': {
                    idiom: "Cost an arm and a leg",
                    meaning: "To be very expensive",
                    example: "That new smartphone costs an arm and a leg."
                },
                'hit the nail on the head': {
                    idiom: "Hit the nail on the head",
                    meaning: "To describe exactly what is causing a situation or problem",
                    example: "You hit the nail on the head when you said she's jealous of your success."
                }
            };
            
            // Find idiom by partial match
            let matchedIdiom = null;
            for (const key of Object.keys(idioms)) {
                if (key.includes(idiomName) || idiomName.includes(key)) {
                    matchedIdiom = key;
                    break;
                }
            }
            
            if (matchedIdiom) {
                const idiom = idioms[matchedIdiom];
                await safeSendText(sock, remoteJid, `*📝 Idiom*\n\n*${idiom.idiom}*\n\n*Meaning:* ${idiom.meaning}\n\n*Example:* ${idiom.example}`);
            } else {
                const availableIdioms = Object.keys(idioms).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Idiom not found*\n\nAvailable idioms: ${availableIdioms}`);
            }
        } catch (err) {
            logger.error('Error in idiom command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving idiom information');
        }
    },
    
    // 16. General Knowledge
    async unitedNations(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            const unInfo = `*🌐 United Nations (UN)*\n\n` +
                `The United Nations is an international organization founded in 1945 after World War II, with the aim of maintaining international peace and security, developing friendly relations among nations, and promoting social progress.\n\n` +
                `*Key Facts:*\n` +
                `• Founded: October 24, 1945\n` +
                `• Headquarters: New York City, USA\n` +
                `• Member States: 193\n` +
                `• Official Languages: Arabic, Chinese, English, French, Russian, Spanish\n` +
                `• Main Bodies: General Assembly, Security Council, Economic and Social Council, Trusteeship Council, International Court of Justice, and the Secretariat\n\n` +
                `*Main Purposes:*\n` +
                `• Maintain international peace and security\n` +
                `• Protect human rights\n` +
                `• Deliver humanitarian aid\n` +
                `• Promote sustainable development\n` +
                `• Uphold international law`;
            
            await safeSendText(sock, remoteJid, unInfo);
        } catch (err) {
            logger.error('Error in unitedNations command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving United Nations information');
        }
    },
    
    async worldWonders(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const wonderType = args.join(' ').toLowerCase().trim();
            
            if (!wonderType || (wonderType !== 'ancient' && wonderType !== 'modern' && wonderType !== 'natural')) {
                const typesInfo = `*🌍 World Wonders*\n\n` +
                    `Types of World Wonders:\n` +
                    `• ancient - The Seven Wonders of the Ancient World\n` +
                    `• modern - The Seven Wonders of the Modern World\n` +
                    `• natural - The Seven Natural Wonders of the World\n\n` +
                    `Use .worldwonders [type] to learn about a specific type of wonders.`;
                
                await safeSendText(sock, remoteJid, typesInfo);
                return;
            }
            
            const wonders = {
                'ancient': `*🏛️ Seven Wonders of the Ancient World*\n\n` +
                    `1. *Great Pyramid of Giza* (Egypt, c. 2560 BCE)\n` +
                    `   The only wonder still largely intact.\n\n` +
                    `2. *Hanging Gardens of Babylon* (Iraq, c. 600 BCE)\n` +
                    `   May be legendary; no definitive archaeological evidence exists.\n\n` +
                    `3. *Temple of Artemis at Ephesus* (Turkey, c. 550 BCE)\n` +
                    `   Rebuilt three times before final destruction.\n\n` +
                    `4. *Statue of Zeus at Olympia* (Greece, c. 435 BCE)\n` +
                    `   A giant seated figure of Zeus made by Phidias.\n\n` +
                    `5. *Mausoleum at Halicarnassus* (Turkey, c. 350 BCE)\n` +
                    `   Tomb built for Mausolus, a satrap in the Persian Empire.\n\n` +
                    `6. *Colossus of Rhodes* (Greece, c. 280 BCE)\n` +
                    `   A statue of the Greek god Helios, destroyed by earthquake.\n\n` +
                    `7. *Lighthouse of Alexandria* (Egypt, c. 280 BCE)\n` +
                    `   One of the tallest man-made structures for many centuries.`,
                
                'modern': `*🏙️ Seven Wonders of the Modern World*\n\n` +
                    `1. *Great Wall of China* (China)\n` +
                    `   Built between the 5th century BCE and the 16th century CE.\n\n` +
                    `2. *Petra* (Jordan)\n` +
                    `   A historical city carved into rock, dating to around 312 BCE.\n\n` +
                    `3. *Christ the Redeemer* (Brazil)\n` +
                    `   A statue of Jesus Christ completed in 1931.\n\n` +
                    `4. *Machu Picchu* (Peru)\n` +
                    `   A 15th-century Inca citadel set high in the Andes Mountains.\n\n` +
                    `5. *Chichen Itza* (Mexico)\n` +
                    `   A large pre-Columbian archaeological site built by the Maya.\n\n` +
                    `6. *Colosseum* (Italy)\n` +
                    `   An amphitheater in Rome built in the 1st century CE.\n\n` +
                    `7. *Taj Mahal* (India)\n` +
                    `   A mausoleum completed in 1643, built by Emperor Shah Jahan.`,
                
                'natural': `*🌋 Seven Natural Wonders of the World*\n\n` +
                    `1. *Grand Canyon* (USA)\n` +
                    `   A steep-sided canyon carved by the Colorado River.\n\n` +
                    `2. *Great Barrier Reef* (Australia)\n` +
                    `   The world's largest coral reef system.\n\n` +
                    `3. *Harbor of Rio de Janeiro* (Brazil)\n` +
                    `   A natural harbor surrounded by granite mountains.\n\n` +
                    `4. *Mount Everest* (Nepal/Tibet)\n` +
                    `   Earth's highest mountain above sea level.\n\n` +
                    `5. *Aurora Borealis/Aurora Australis* (Polar regions)\n` +
                    `   Natural light displays in the Earth's sky (Northern and Southern Lights).\n\n` +
                    `6. *Victoria Falls* (Zambia/Zimbabwe)\n` +
                    `   A waterfall on the Zambezi River.\n\n` +
                    `7. *Parícutin* (Mexico)\n` +
                    `   A cinder cone volcano that suddenly erupted in a cornfield in 1943.`
            };
            
            if (wonders[wonderType]) {
                await safeSendText(sock, remoteJid, wonders[wonderType]);
            } else {
                await safeSendText(sock, remoteJid, `*❌ Wonder type not found*\n\nPlease choose from: ancient, modern, natural`);
            }
        } catch (err) {
            logger.error('Error in worldWonders command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving world wonders information');
        }
    },
    
    async mythology(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const mythologyType = args.join(' ').toLowerCase().trim();
            
            if (!mythologyType) {
                const typesInfo = `*🏛️ Mythology*\n\n` +
                    `Types of Mythology:\n` +
                    `• greek - Greek mythology\n` +
                    `• norse - Norse mythology\n` +
                    `• egyptian - Egyptian mythology\n` +
                    `• roman - Roman mythology\n\n` +
                    `Use .mythology [type] to learn about a specific mythology.`;
                
                await safeSendText(sock, remoteJid, typesInfo);
                return;
            }
            
            const mythologies = {
                'greek': `*🏛️ Greek Mythology*\n\n` +
                    `Greek mythology consists of stories about the gods, heroes, and rituals of the ancient Greeks. It forms a significant part of ancient Greek religion and culture.\n\n` +
                    `*Major Deities:*\n` +
                    `• Zeus - King of the gods, ruler of Mount Olympus, god of the sky and thunder\n` +
                    `• Poseidon - God of the sea, earthquakes, and horses\n` +
                    `• Hades - God of the underworld and the dead\n` +
                    `• Athena - Goddess of wisdom, warfare, and crafts\n` +
                    `• Apollo - God of music, arts, knowledge, healing, prophecy, and the sun\n` +
                    `• Artemis - Goddess of the hunt, wilderness, and the moon\n` +
                    `• Aphrodite - Goddess of love, beauty, and sexuality`,
                
                'norse': `*🏛️ Norse Mythology*\n\n` +
                    `Norse mythology consists of tales of various deities, heroes, and beings originating from North Germanic traditions.\n\n` +
                    `*Major Deities:*\n` +
                    `• Odin - Chief god, associated with wisdom, healing, death, royalty, and poetry\n` +
                    `• Thor - God of thunder, lightning, storms, oak trees, strength, and fertility\n` +
                    `• Loki - A trickster god, shape-shifter, and mischief-maker\n` +
                    `• Freyja - Goddess of love, beauty, fertility, war, and death\n` +
                    `• Heimdall - Guardian of Bifröst, the rainbow bridge that leads to Asgard\n` +
                    `• Hel - Ruler of Helheim, the realm of the dead\n` +
                    `• Baldr - God of light, joy, purity, and the summer sun`,
                
                'egyptian': `*🏛️ Egyptian Mythology*\n\n` +
                    `Egyptian mythology consists of stories and beliefs from ancient Egypt about their gods and the universe.\n\n` +
                    `*Major Deities:*\n` +
                    `• Ra - God of the sun, creation, and rebirth\n` +
                    `• Osiris - God of the afterlife, death, and resurrection\n` +
                    `• Isis - Goddess of magic, motherhood, and fertility\n` +
                    `• Horus - God of kingship and the sky\n` +
                    `• Anubis - God of mummification and the afterlife\n` +
                    `• Thoth - God of wisdom, writing, and the moon\n` +
                    `• Bastet - Goddess of home, fertility, and protection`,
                
                'roman': `*🏛️ Roman Mythology*\n\n` +
                    `Roman mythology consists of myths originating from ancient Rome, heavily influenced by Greek mythology and Etruscan mythology.\n\n` +
                    `*Major Deities:*\n` +
                    `• Jupiter - King of the gods, god of sky and thunder (Greek equivalent: Zeus)\n` +
                    `• Neptune - God of the sea (Greek equivalent: Poseidon)\n` +
                    `• Pluto - God of the underworld (Greek equivalent: Hades)\n` +
                    `• Minerva - Goddess of wisdom and strategic warfare (Greek equivalent: Athena)\n` +
                    `• Venus - Goddess of love and beauty (Greek equivalent: Aphrodite)\n` +
                    `• Mars - God of war (Greek equivalent: Ares)\n` +
                    `• Mercury - Messenger god (Greek equivalent: Hermes)`
            };
            
            // Find mythology by partial match
            let matchedMythology = null;
            for (const key of Object.keys(mythologies)) {
                if (mythologyType.includes(key) || key.includes(mythologyType)) {
                    matchedMythology = key;
                    break;
                }
            }
            
            if (matchedMythology) {
                await safeSendText(sock, remoteJid, mythologies[matchedMythology]);
            } else {
                const availableMythologies = Object.keys(mythologies).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Mythology not found*\n\nAvailable mythologies: ${availableMythologies}`);
            }
        } catch (err) {
            logger.error('Error in mythology command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving mythology information');
        }
    },
    
    async nobelPrize(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const category = args.join(' ').toLowerCase().trim();
            
            if (!category) {
                const categoriesInfo = `*🏆 Nobel Prize*\n\n` +
                    `The Nobel Prize is awarded annually for outstanding achievements in:\n\n` +
                    `• physics - Discoveries in physics\n` +
                    `• chemistry - Discoveries in chemistry\n` +
                    `• medicine - Discoveries in physiology or medicine\n` +
                    `• literature - Outstanding work in literature\n` +
                    `• peace - Work for peace and fraternity among nations\n` +
                    `• economics - Work in economic sciences\n\n` +
                    `Use .nobelprize [category] to learn about a specific Nobel Prize category.`;
                
                await safeSendText(sock, remoteJid, categoriesInfo);
                return;
            }
            
            const nobelInfo = {
                'physics': `*🏆 Nobel Prize in Physics*\n\n` +
                    `Established in 1901 from the will of Alfred Nobel, the Nobel Prize in Physics is awarded by the Royal Swedish Academy of Sciences for groundbreaking discoveries in physics.\n\n` +
                    `*First Recipient:* Wilhelm Röntgen (1901) for the discovery of X-rays\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Albert Einstein (1921) for the photoelectric effect\n` +
                    `• Marie Curie (1903) for research on radiation phenomena\n` +
                    `• Richard Feynman (1965) for quantum electrodynamics\n` +
                    `• Stephen Hawking (never awarded the Nobel Prize despite his contributions)\n` +
                    `• Peter Higgs (2013) for the discovery of the Higgs boson`,
                
                'chemistry': `*🏆 Nobel Prize in Chemistry*\n\n` +
                    `The Nobel Prize in Chemistry is awarded by the Royal Swedish Academy of Sciences for groundbreaking discoveries in chemistry.\n\n` +
                    `*First Recipient:* Jacobus Henricus van 't Hoff (1901) for laws of chemical dynamics and osmotic pressure\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Marie Curie (1911) for the discovery of radium and polonium\n` +
                    `• Linus Pauling (1954) for research into the nature of chemical bonds\n` +
                    `• Dorothy Crowfoot Hodgkin (1964) for determining the structures of biochemical substances\n` +
                    `• Ahmed Zewail (1999) for studying chemical reactions in extremely short timescales`,
                
                'medicine': `*🏆 Nobel Prize in Physiology or Medicine*\n\n` +
                    `The Nobel Prize in Physiology or Medicine is awarded by the Nobel Assembly at the Karolinska Institute for discoveries in physiology or medicine.\n\n` +
                    `*First Recipient:* Emil von Behring (1901) for work on serum therapy against diphtheria\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Alexander Fleming, Ernst Chain, and Howard Florey (1945) for the discovery of penicillin\n` +
                    `• James Watson, Francis Crick, and Maurice Wilkins (1962) for discovering the structure of DNA\n` +
                    `• Jonas Salk (never awarded despite developing the polio vaccine)\n` +
                    `• Elizabeth Blackburn, Carol Greider, and Jack Szostak (2009) for discovering how chromosomes are protected by telomeres`,
                
                'literature': `*🏆 Nobel Prize in Literature*\n\n` +
                    `The Nobel Prize in Literature is awarded by the Swedish Academy for outstanding contributions in literature.\n\n` +
                    `*First Recipient:* Sully Prudhomme (1901), a French poet\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Rabindranath Tagore (1913), the first non-European to win\n` +
                    `• Ernest Hemingway (1954) for mastery of narrative\n` +
                    `• Gabriel García Márquez (1982) for novels and short stories\n` +
                    `• Toni Morrison (1993), the first African American woman to win\n` +
                    `• Bob Dylan (2016) for creating new poetic expressions in American song tradition`,
                
                'peace': `*🏆 Nobel Peace Prize*\n\n` +
                    `The Nobel Peace Prize is awarded by the Norwegian Nobel Committee to those who have done outstanding work for peace and fraternity among nations.\n\n` +
                    `*First Recipients:* Jean Henry Dunant and Frédéric Passy (1901)\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Martin Luther King Jr. (1964) for non-violent civil rights work\n` +
                    `• Mother Teresa (1979) for work helping the poor and suffering\n` +
                    `• Nelson Mandela and F.W. de Klerk (1993) for peaceful end to apartheid\n` +
                    `• Malala Yousafzai (2014) for struggle for education rights\n` +
                    `• International organizations like the Red Cross, UN, and Médecins Sans Frontières`,
                
                'economics': `*🏆 Nobel Prize in Economic Sciences*\n\n` +
                    `The Nobel Memorial Prize in Economic Sciences was established in 1968 by the Sveriges Riksbank (Sweden's central bank).\n\n` +
                    `*First Recipients:* Ragnar Frisch and Jan Tinbergen (1969) for developing and applying dynamic models for economic processes\n\n` +
                    `*Notable Recipients:*\n` +
                    `• Milton Friedman (1976) for achievements in consumption analysis and monetary history/theory\n` +
                    `• Amartya Sen (1998) for contributions to welfare economics\n` +
                    `• Daniel Kahneman (2002) for integrating psychological insights into economics\n` +
                    `• Elinor Ostrom (2009), first woman to win, for analysis of economic governance`
            };
            
            let matchedCategory = null;
            for (const key of Object.keys(nobelInfo)) {
                if (category.includes(key) || key.includes(category)) {
                    matchedCategory = key;
                    break;
                }
            }
            
            if (matchedCategory) {
                await safeSendText(sock, remoteJid, nobelInfo[matchedCategory]);
            } else {
                const availableCategories = Object.keys(nobelInfo).join(', ');
                await safeSendText(sock, remoteJid, `*❌ Category not found*\n\nAvailable categories: ${availableCategories}`);
            }
        } catch (err) {
            logger.error('Error in nobelPrize command:', err);
            await safeSendText(sock, message.key.remoteJid, 'Error retrieving Nobel Prize information');
        }
    },
    
    // Initialize function
    async init() {
        try {
            return true;
        } catch (err) {
            console.error('Error initializing educational module:', err);
            return false;
        }
    }
};

module.exports = {
    commands: educationalCommands,
    category: 'educational',
    init: educationalCommands.init
};
