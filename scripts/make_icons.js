const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Algoritmo simples de cálculo CRC32 para empacotamento PNG
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
  }
  return ~c;
}

// Cria uma estrutura binária de chunk PNG
function createChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Cria uma imagem PNG contendo um quadrado azul escuro (#1E3A8A)
 * com um sinal de "+" branco no centro.
 */
function generateIconPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // Largura
  ihdrData.writeUInt32BE(size, 4); // Altura
  ihdrData[8] = 8;  // Bit depth
  ihdrData[9] = 6;  // Color type (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Desenhar os pixels em RGBA
  const bytesPerPixel = 4;
  const scanlineLength = 1 + size * bytesPerPixel; // 1 byte de filtro + pixels
  const rawData = Buffer.alloc(size * scanlineLength);

  // Desenhar o ícone: azul de fundo, cruz branca no meio
  for (let y = 0; y < size; y++) {
    // Definir tipo de filtro como 0 (None)
    rawData[y * scanlineLength] = 0;

    for (let x = 0; x < size; x++) {
      const idx = y * scanlineLength + 1 + x * bytesPerPixel;

      // Coordenadas centrais relativas
      const px = x / size;
      const py = y / size;

      // Condição para desenhar o sinal de "+" no meio
      // Cruz central ocupando a faixa de 0.45 a 0.55
      const thickness = 0.08;
      const length = 0.3;
      const isHorizontal = Math.abs(py - 0.5) < thickness && Math.abs(px - 0.5) < length;
      const isVertical = Math.abs(px - 0.5) < thickness && Math.abs(py - 0.5) < length;

      if (isHorizontal || isVertical) {
        // Branco (Sinal de +)
        rawData[idx] = 255;     // R
        rawData[idx + 1] = 255; // G
        rawData[idx + 2] = 255; // B
        rawData[idx + 3] = 255; // A
      } else {
        // Azul Corporativo (#1E3A8A)
        rawData[idx] = 30;      // R
        rawData[idx + 1] = 58;  // G
        rawData[idx + 2] = 138; // B
        rawData[idx + 3] = 255; // A
      }
    }
  }

  // IDAT Chunk (pixels deflacionados com zlib)
  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Criar diretórios se não existirem
const iconsDir = path.join(__dirname, '../assets/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Gerar ícones nos tamanhos 16, 48 e 128
[16, 48, 128].forEach(size => {
  const pngBuffer = generateIconPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, pngBuffer);
  console.log(`Ícone gerado: ${filePath} (${size}x${size})`);
});
