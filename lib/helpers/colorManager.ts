// Thanks to https://stackoverflow.com/questions/21576719/how-to-convert-cie-color-space-into-rgb-or-hex-color-code-in-php
export function getRBGFromCIE(cieX: number, cieY: number) {
  const x = (cieX * cieY) / cieY;
  const y = cieY;
  const z = ((1 - cieX - cieY) * cieY) / cieY;

  const R = 3.240479 * x + -1.537150 * y + -0.498535 * z;
  const G = -0.969256 * x + 1.875992 * y + 0.041556 * z;
  const B = 0.055648 * x + -0.204043 * y + 1.057311 * z;

  return [R, G, B];
}

// The three functions below thanks to https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function componentToHex(c) {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

export function rgbToHex(r, g, b) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}
