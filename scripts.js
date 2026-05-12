// HELPERS //
let lastBaseDir = "";

function getCSSGlobalVar(variable) {
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    // IMPORTANT: Still use --[var name] like in CSS!
    const retrieved = styles.getPropertyValue(variable).trim();
    return retrieved;
}

function findBracketSubs(string) { // finds substrings in brackets
    const regex = /\[(.*?)\]/g;
    const matches = [...string.matchAll(regex)];
    const results = matches.map(match => match[1]);

    return results;
}

function calculateFreqFromPath(fund, path) {
    let f = fund;
    for (let char of path) {
        if (char === '+') f *= (2/1);
        if (char === '-') f *= (1/2);
        if (char === '2') f *= (3/2);
        if (char === 'b') f *= (2/3);
        if (char === '3') f *= (5/4);
        if (char === 'c') f *= (4/5);
        if (char === '4') f *= (7/4);
        if (char === 'd') f *= (4/7);
        if (char === '5') f *= (11/4);
        if (char === 'e') f *= (4/11);
        if (char === '6') f *= (13/4);
        if (char === 'f') f *= (4/13);
    }
    return f;
}

function getHarmonicType(char) {
    const types = {
        '+': 'harmonic-octave', '-': 'harmonic-octave',
        '2': 'harmonic-chy', 'b': 'harmonic-chy',
        '3': 'harmonic-ly', 'c': 'harmonic-ly',
        '4': 'harmonic-my', 'd': 'harmonic-my',
        '5': 'harmonic-zy', 'e': 'harmonic-zy',
        '6': 'harmonic-gnay', 'f': 'harmonic-gnay'
    };
    return types[char];
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function wait(ms) {
  await delay(ms);
}

async function loadAudioBuffer(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error("failed to load audio:", url, e);
        return null;
    }
}

function compressIntervalString(str) {
    if (!str) return "";
    
    return str.replace(/([0-9][ud])(\1)*/g, (match, p1) => {
        const num = p1[0];
        const dir = p1[1];
        const reps = match.length / 2;
        
        return num + dir.repeat(reps);
    });
}

function calculatePrefixDeviation(lastPath, currentPath, invertMap) {
    let i = 0;
    // Cari titik kecocokan (common prefix) terpanjang antara kedua path
    while (i < lastPath.length && i < currentPath.length && lastPath[i] === currentPath[i]) {
        i++;
    }

    // Karakter yang dihapus/ditinggalkan dari path lama harus di-invert arahnya (mundur)
    let backwardSteps = "";
    for (let j = lastPath.length - 1; j >= i; j--) {
        backwardSteps += invertMap[lastPath[j]] || "";
    }

    let forwardSteps = currentPath.substring(i);

    // return back and front
    return backwardSteps + forwardSteps;
}

// NOTES //
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, length, type, volume) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + length);
}

function playSound(sound, basefreq, baselength, freq, length, volume) {
    if (!soundBuffer || !(soundBuffer instanceof AudioBuffer)) {
        console.warn("playSound: Sumber audio tidak valid atau belum selesai dimuat.");
        return;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffer;

    const pitchRatio = freq / basefreq;
    source.playbackRate.setValueAtTime(pitchRatio, audioCtx.currentTime);

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(audioCtx.currentTime);
    source.stop(audioCtx.currentTime + length);
}

// CHORDS //
let prevChord = [];
function playChord(string, fund, noteLength, type, area, volume) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    let currentFreq = fund;
    let currentPath = '';
    const notesToPlay = [];

    let basePath = '';
    let processString = string;

    if (string.startsWith('{')) {
        const endBracket = string.indexOf('}');
        if (endBracket !== -1) {
            basePath = string.substring(1, endBracket);
            processString = string.substring(endBracket + 1);
        }
    }

    for (let i = 0; i < processString.length; i++) {
        const char = processString[i];

        if (char !== '>' && char !== '<') {
            currentPath += char;
        }

        if (char === '>') {
            const fullPath = basePath + currentPath;
            const finalFreq = calculateFreqFromPath(fund, fullPath);

            notesToPlay.push({
                freq: finalFreq, 
                directory: fullPath,
                prefixLength: basePath.length,
                duration: noteLength 
            });

            currentPath = '';
        }

        if (char === '<') {
            if (notesToPlay.length > 0) {
                notesToPlay[notesToPlay.length - 1].duration += noteLength;
            }
        }
    }

    if (typeof visualizeChord === "function") {
        visualizeChord(notesToPlay, fund, area);
    }

    notesToPlay.forEach(note => {
        const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    
        if (typeof type === 'string' && waveTypes.includes(type)) {
            playTone(note.freq, note.duration, type, volume);
        } else {
            playSound(type, 261.63, 2, note.freq, note.duration, volume);
        }
    });

    prevChord = notesToPlay;
    return notesToPlay;
}

// SONGS //
async function playSong(s, fund, noteLength, type) {
    let lastBaseDir = "";
    
    const stringRaw = s.replace(/\s/g, ''); 
    const notesArray = findBracketSubs(stringRaw); 

    // set starting fundamental
    let currentFundamental = fund;

    // volume
    const volumeSlider = document.getElementById('volume');
    
    for (let i = 0; i < notesArray.length; i++) {
        const currentVolume = parseFloat(volumeSlider.value); 

        let currentItem = notesArray[i];

        // check for substring !{[number]} e.g. !{440}
        if (currentItem.startsWith('!{') && currentItem.endsWith('}')) {
            // take number from brackets
            const newFund = parseFloat(currentItem.match(/\{([^}]+)\}/)[1]);
            if (!isNaN(newFund)) {
                currentFundamental = newFund;
            }
            // continue(dont play note)
            continue; 
        }

        let currentNotes = [];

        if (currentItem === '=') {
            if (prevChord) {
                prevChord.forEach(note => playTone(note.freq, note.duration, type, currentVolume));
                visualizeChord(prevChord, currentFundamental); 
            }
        } else {
            playChord(currentItem, currentFundamental, noteLength, type, null, currentVolume);
        }

        await wait(noteLength * 1000);
    }
}

document.getElementById('sample').addEventListener('click', async () => {
    const textarea = document.querySelector('textarea'); 
    const volumeSlider = document.getElementById('volume'); 
    
    const content = textarea.value;
    const volume = volumeSlider ? parseFloat(volumeSlider.value) : 0.2;
    
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    const audioPath = 'triangle'; 
    
    console.log("loading instrument sample...");
    const soundBuffer = await loadAudioBuffer(audioPath);

    if (soundBuffer) {
        await playSong(content, 261.63, 0.5, soundBuffer, volume);
    } else {
        console.warn("triangle fallback");
        await playSong(content, 261.63, 0.5, 'triangle', volume);
    }
});

// CHORD DIAGRAMS //
function spawnHarmonicImg(cls, octaveDecimal, imageSrc, area) {
    const container = document.createElement('div');
    container.className = cls;
    
    // set pitch level
    container.style.setProperty('--pitchlevel', octaveDecimal);

    // give chord area the div
    area.appendChild(container);

    return container;
}

function visualizeNote(targetFreq, fund, directory, prefixLength = 0, area, existingLevels = new Set()) {
    if (!area) area = document.querySelector('.score') || document.body;
    
    let currentPitchLevel = 0; 
    const intervalMap = {
        '+': 1, '-': -1, '2': Math.log2(3/2), 'b': -Math.log2(3/2),
        '3': Math.log2(5/4), 'c': -Math.log2(5/4), '4': Math.log2(7/4),
        'd': -Math.log2(7/4), '5': Math.log2(11/4), 'e': -Math.log2(11/4),
        '6': Math.log2(13/4), 'f': -Math.log2(13/4)
    };
    
    for (let i = 0; i < directory.length; i++) {
        const char = directory[i];
        const intervalValue = intervalMap[char];
        
        if (intervalValue !== undefined) {
            const isPrefix = i < prefixLength; 
            const harmonicType = getHarmonicType(char);
            const direction = intervalValue >= 0 ? 1 : -1;

            if (!isPrefix) {
                const gapLine = document.createElement('div');
                gapLine.className = harmonicType;
                gapLine.style.setProperty('--pitchlevel', currentPitchLevel);
                gapLine.style.setProperty('--dir', direction);
                area.appendChild(gapLine);
            }

            currentPitchLevel += intervalValue;

            const isLastNote = (i === directory.length - 1);
            const imagePath = isLastNote ? 'assets/pitch-line.png' : 'assets/pitch-line-dotted.png';
            
            const roundedLevel = Math.round(currentPitchLevel * 1000) / 1000;
            const isSolid = isLastNote && !area.classList.contains('root-only');

            if (!isPrefix || isLastNote) {
                if (!isLastNote && existingLevels.has(roundedLevel)) {
                    continue; 
                }

                const pLine = spawnHarmonicImg('pitchline', currentPitchLevel, imagePath, area);
                
                if (isLastNote) {
                    pLine.setAttribute('data-freq', Math.round(targetFreq));
                    pLine.classList.add('active-note'); 
                    pLine.style.setProperty('--ghost', '0');
                    existingLevels.add(roundedLevel); // Tandai level ini sudah punya garis solid
                } else {
                    pLine.classList.add('ghost-note'); 
                    pLine.style.setProperty('--ghost', '1');
                } 
            }
        }
    }
}

let lastPrefixPath = "";

function visualizeChord(notesToPlay, fund, area) {
    const score = document.querySelector('.score');
    let container = score.querySelector('.chordarea');
    
    if (!container) {
        container = document.createElement('div');
        container.className = 'chordarea';
        score.appendChild(container);
    }

    container.innerHTML = '';

    if (notesToPlay.length > 0) {
        const intervalMap = {
            '+': 1, '-': -1, '2': Math.log2(3/2), 'b': -Math.log2(3/2),
            '3': Math.log2(5/4), 'c': -Math.log2(5/4), '4': Math.log2(7/4),
            'd': -Math.log2(7/4), '5': Math.log2(11/4), 'e': -Math.log2(11/4),
            '6': Math.log2(13/4), 'f': -Math.log2(13/4)
        };

        const invertMap = {
            '+': '-', '-': '+', '2': 'b', 'b': '2',
            '3': 'c', 'c': '3', '4': 'd', 'd': '4',
            '5': 'e', 'e': '5', '6': 'f', 'f': '6'
        };

        const charMap = {
            '+': '1u', '-': '1d', '2': '2u', 'b': '2d',
            '3': '3u', 'c': '3d', '4': '4u', 'd': '4d',
            '5': '5u', 'e': '5d', '6': '6u', 'f': '6d',
        };

        const existingLevels = new Set();
        
        const prefixLength = notesToPlay[0].prefixLength || 0;
        const fullPathExample = notesToPlay[0].directory;
        const prefixPath = fullPathExample.substring(0, prefixLength) || "";

        // find played notes
        notesToPlay.forEach(note => {
            let level = 0;
            for (let char of note.directory) {
                level += (intervalMap[char] || 0);
            }
            existingLevels.add(Math.round(level * 1000) / 1000);
        });

        // draw root
        let currentAbsoluteRootLevel = 0;
        for (let char of prefixPath) {
            currentAbsoluteRootLevel += (intervalMap[char] || 0);
        }
        
        const roundedRootLevel = Math.round(currentAbsoluteRootLevel * 1000) / 1000;
        const isRootPlayed = existingLevels.has(roundedRootLevel);

        if (!isRootPlayed) {
            const pLine = spawnHarmonicImg('pitchline', currentAbsoluteRootLevel, 'assets/pitch-line-dotted.png', container);
            pLine.classList.add('ghost-note');
            pLine.style.setProperty('--ghost', '1');
        } else {
            if (prefixPath === "") {
                const pLine = spawnHarmonicImg('pitchline', 0, 'assets/pitch-line.png', container);
                pLine.setAttribute('data-freq', Math.round(fund));
                pLine.classList.add('active-note');
                pLine.style.setProperty('--ghost', '0');
            }
        }

        // get root
        let minLevel = currentAbsoluteRootLevel;

        notesToPlay.forEach(note => {
            visualizeNote(note.freq, fund, note.directory, note.prefixLength, container, existingLevels);
            
            let currentNoteLevel = 0;
            for (let char of note.directory) {
                currentNoteLevel += (intervalMap[char] || 0);
            }
            if (currentNoteLevel < minLevel) minLevel = currentNoteLevel;
        });

        let deviationString = calculatePrefixDeviation(lastPrefixPath, prefixPath, invertMap);
        
        lastPrefixPath = prefixPath;

        // translate deviation
        let rawDisplayed = "";
        for (let i = 0; i < deviationString.length; i++) {
            rawDisplayed += charMap[deviationString[i]] || "";
        }

        const compressedDisplayed = compressIntervalString(rawDisplayed);

        /* disabling infobox for a while bc it's not working properly
        // infobox setup
        const infoBox = document.createElement('div');
        infoBox.className = 'infobox';
        infoBox.innerText = compressedDisplayed || "!";
        
        infoBox.style.setProperty('--pitchlevel', minLevel - 0.6); 
        container.appendChild(infoBox);  
        */    
    }
}