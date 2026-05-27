// HELPERS //
let lastBaseDir = "";
let lastPrefixPath = "";

function getCSSGlobalVar(variable) {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    return styles.getPropertyValue(variable).trim();
}

function findBracketSubs(string) {
    const regex = /\[(.*?)\]/g;
    const matches = [...string.matchAll(regex)];
    return matches.map(match => match[1]);
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
async function wait(ms) { await delay(ms); }

async function loadAudioBuffer(url) {
    const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    if (waveTypes.includes(url)) return url; // Don't fetch standard waves
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error("failed to load audio:", url, e);
        return 'triangle'; // Fallback
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
    while (i < lastPath.length && i < currentPath.length && lastPath[i] === currentPath[i]) {
        i++;
    }
    let backwardSteps = "";
    for (let j = lastPath.length - 1; j >= i; j--) {
        backwardSteps += invertMap[lastPath[j]] || "";
    }
    return backwardSteps + currentPath.substring(i);
}

// AUDIO //
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

function playSound(buffer, basefreq, baselength, freq, length, volume) {
    if (!buffer || !(buffer instanceof AudioBuffer)) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(freq / basefreq, audioCtx.currentTime);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(audioCtx.currentTime);
    source.stop(audioCtx.currentTime + length);
}

// CHORDS //
let prevChord = [];
function playChord(string, fund, noteLength, soundData, area, volume) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
        if (char !== '>' && char !== '<') currentPath += char;
        if (char === '>') {
            const fullPath = basePath + currentPath;
            notesToPlay.push({
                freq: calculateFreqFromPath(fund, fullPath), 
                directory: fullPath,
                prefixLength: basePath.length,
                duration: noteLength 
            });
            currentPath = '';
        }
        if (char === '<' && notesToPlay.length > 0) {
            notesToPlay[notesToPlay.length - 1].duration += noteLength;
        }
    }

    visualizeChord(notesToPlay, fund, area);

    notesToPlay.forEach(note => {
        if (typeof soundData === 'string') {
            playTone(note.freq, note.duration, soundData, volume);
        } else {
            playSound(soundData, 261.63, 2, note.freq, note.duration, volume);
        }
    });

    prevChord = notesToPlay;
    return notesToPlay;
}

// SONGS //
async function playSong(s) {
    const score = document.querySelector('.score');
    if (!score) return;
    score.innerHTML = ''; 

    const trackParts = s.split('$').filter(t => t.trim() !== "");

    const trackPromises = trackParts.map(async (part) => {
        const headerMatch = part.match(/^\(([^|]+)\|([^|]+)\|([^)]+)\)/);
        if (!headerMatch) return;

        const trackSoundName = headerMatch[1].trim();
        const trackFund = parseFloat(headerMatch[2]);
        const trackVol = parseFloat(headerMatch[3]);
        const body = part.replace(headerMatch[0], '');

        const trackChordArea = document.createElement('div');
        trackChordArea.className = 'chordarea';
        trackChordArea.style.cssText = "position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; height: 100%; pointer-events: none;";
        score.appendChild(trackChordArea);

        const soundData = await loadAudioBuffer(trackSoundName);
        const notesArray = findBracketSubs(body);
        let currentFundamental = trackFund;

        for (let i = 0; i < notesArray.length; i++) {
            let item = notesArray[i];
            if (item.startsWith('!{')) {
                const newF = parseFloat(item.match(/\{([^}]+)\}/)[1]);
                if (!isNaN(newF)) currentFundamental = newF;
                continue;
            }
            if (item === '=') {
                if (prevChord) {
                    prevChord.forEach(n => {
                        if (typeof soundData === 'string') playTone(n.freq, n.duration, soundData, trackVol);
                        else playSound(soundData, 261.63, 2, n.freq, n.duration, trackVol);
                    });
                    visualizeChord(prevChord, currentFundamental, trackChordArea);
                }
            } else {
                playChord(item, currentFundamental, 0.5, soundData, trackChordArea, trackVol);
            }
            await wait(500);
        }
    });
    await Promise.all(trackPromises);
}

// VISUALIZER //
function spawnHarmonicImg(cls, octaveDecimal, imageSrc, area) {
    const container = document.createElement('div');
    container.className = cls;
    container.style.setProperty('--pitchlevel', octaveDecimal);
    area.appendChild(container);
    return container;
}

function visualizeNote(targetFreq, fund, directory, prefixLength = 0, area, existingLevels) {
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
            const roundedLevel = Math.round(currentPitchLevel * 1000) / 1000;

            if (!isPrefix || isLastNote) {
                if (!isLastNote && existingLevels.has(roundedLevel)) continue; 
                const pLine = spawnHarmonicImg('pitchline', currentPitchLevel, '', area);
                if (isLastNote) {
                    pLine.setAttribute('data-freq', Math.round(targetFreq));
                    pLine.classList.add('active-note'); 
                    existingLevels.add(roundedLevel);
                } else {
                    pLine.classList.add('ghost-note'); 
                } 
            }
        }
    }
}

function visualizeChord(notesToPlay, fund, area) {
    if (!area) return;
    area.innerHTML = '';
    const existingLevels = new Set();

    if (notesToPlay.length > 0) {
        const intervalMap = {'+': 1, '-': -1, '2': Math.log2(3/2), 'b': -Math.log2(3/2), '3': Math.log2(5/4), 'c': -Math.log2(5/4), '4': Math.log2(7/4), 'd': -Math.log2(7/4), '5': Math.log2(11/4), 'e': -Math.log2(11/4), '6': Math.log2(13/4), 'f': -Math.log2(13/4)};
        const invertMap = {'+': '-', '-': '+', '2': 'b', 'b': '2', '3': 'c', 'c': '3', '4': 'd', 'd': '4', '5': 'e', 'e': '5', '6': 'f', 'f': '6'};
        
        const prefixPath = notesToPlay[0].directory.substring(0, notesToPlay[0].prefixLength || 0);

        notesToPlay.forEach(note => {
            let level = 0;
            for (let char of note.directory) level += (intervalMap[char] || 0);
            existingLevels.add(Math.round(level * 1000) / 1000);
        });

        let rootLevel = 0;
        for (let char of prefixPath) rootLevel += (intervalMap[char] || 0);
        
        if (!existingLevels.has(Math.round(rootLevel * 1000) / 1000)) {
            spawnHarmonicImg('pitchline', rootLevel, '', area).classList.add('ghost-note');
        } else if (prefixPath === "") {
            const pLine = spawnHarmonicImg('pitchline', 0, '', area);
            pLine.classList.add('active-note');
            pLine.setAttribute('data-freq', Math.round(fund));
        }

        notesToPlay.forEach(note => {
            visualizeNote(note.freq, fund, note.directory, note.prefixLength, area, existingLevels);
        });
    }
}

// UI //
document.getElementById('sample').addEventListener('click', async () => {
    const textarea = document.querySelector('textarea'); 
    const content = textarea.value;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    
    if (content.includes('$(')) {
        await playSong(content);
    } else {
        await playSong("$(triangle|261.63|0.2)" + content);
    }
});
