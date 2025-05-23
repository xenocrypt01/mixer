const vocalsInput = document.getElementById('vocals');
const beatInput = document.getElementById('beat');
const vocalsPlayer = document.getElementById('vocalsPlayer');
const beatPlayer = document.getElementById('beatPlayer');
const playBothBtn = document.getElementById('playBoth');
const downloadMixBtn = document.getElementById('downloadMix');

let vocalsFile, beatFile;

vocalsInput.addEventListener('change', () => {
  vocalsFile = vocalsInput.files[0];
  if (vocalsFile) {
    vocalsPlayer.src = URL.createObjectURL(vocalsFile);
  }
});

beatInput.addEventListener('change', () => {
  beatFile = beatInput.files[0];
  if (beatFile) {
    beatPlayer.src = URL.createObjectURL(beatFile);
  }
});

playBothBtn.addEventListener('click', () => {
  vocalsPlayer.currentTime = 0;
  beatPlayer.currentTime = 0;
  vocalsPlayer.play();
  beatPlayer.play();
});

downloadMixBtn.addEventListener('click', async () => {
  if (!vocalsFile || !beatFile) {
    alert('Please upload both vocals and beat files first.');
    return;
  }
  try {
    const context = new AudioContext();

    // Decode both audio files
    const vocalsBuffer = await decodeFile(vocalsFile, context);
    const beatBuffer = await decodeFile(beatFile, context);

    // Mix buffers by creating offline context (to render mixed audio)
    const length = Math.max(vocalsBuffer.length, beatBuffer.length);
    const offlineContext = new OfflineAudioContext(2, length, vocalsBuffer.sampleRate);

    // Vocals source
    const vocalsSource = offlineContext.createBufferSource();
    vocalsSource.buffer = vocalsBuffer;

    // Beat source
    const beatSource = offlineContext.createBufferSource();
    beatSource.buffer = beatBuffer;

    // Gain nodes to control volume (optional, adjust as needed)
    const vocalsGain = offlineContext.createGain();
    vocalsGain.gain.value = 1.0; // vocals volume

    const beatGain = offlineContext.createGain();
    beatGain.gain.value = 1.0; // beat volume

    vocalsSource.connect(vocalsGain).connect(offlineContext.destination);
    beatSource.connect(beatGain).connect(offlineContext.destination);

    vocalsSource.start(0);
    beatSource.start(0);

    // Render mixed audio
    const renderedBuffer = await offlineContext.startRendering();

    // Export to WAV blob
    const wavBlob = bufferToWavBlob(renderedBuffer);

    // Trigger download
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'mixed_audio.wav';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

  } catch (e) {
    alert('Error mixing files: ' + e.message);
    console.error(e);
  }
});

// Helper: decode audio file to AudioBuffer
function decodeFile(file, audioContext) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Helper: convert AudioBuffer to WAV Blob
// Based on https://stackoverflow.com/a/34992002
function bufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [],
        sampleRate = buffer.sampleRate;

  let offset = 0;
  // write WAV header
  function writeString(s) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  }
  writeString('RIFF'); // ChunkID
  view.setUint32(offset, length - 8, true); offset += 4; // ChunkSize
  writeString('WAVE'); // Format
  writeString('fmt '); // Subchunk1ID
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM)
  view.setUint16(offset, numOfChan, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
  view.setUint32(offset, sampleRate * numOfChan * 2, true); offset += 4; // ByteRate
  view.setUint16(offset, numOfChan * 2, true); offset += 2; // BlockAlign
  view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
  writeString('data'); // Subchunk2ID
  view.setUint32(offset, length - offset - 4, true); offset += 4; // Subchunk2Size

  // write interleaved data
  for (let i = 0; i < numOfChan; i++)
    channels.push(buffer.getChannelData(i));

  let pos = offset;
  for (let i = 0; i < buffer.length; i++) {
    for (
