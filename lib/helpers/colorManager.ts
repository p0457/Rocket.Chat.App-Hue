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

// https://github.com/tgardner851/cie-rgb-converter
/**
 * Converts CIE color space to RGB color space
 * @param {Number} x
 * @param {Number} y
 * @param {Number} brightness - Ranges from 1 to 254
 * @return {Array} Array that contains the color values for red, green and blue
 */
export function cie_to_rgb(x: number, y: number, brightness: number): Array<number> {
  // Set to maximum brightness if no custom value was given (Not the slick ECMAScript 6 way for compatibility reasons)
  if (brightness === undefined) {
    brightness = 254;
  }

  const z = 1.0 - x - y;
  const Y = Number((brightness / 254).toFixed(2));
  const X = (Y / y) * x;
  const Z = (Y / y) * z;

  // Convert to RGB using Wide RGB D65 conversion
  let red 	=  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let green 	= -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let blue 	=  X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  // If red, green or blue is larger than 1.0 set it back to the maximum of 1.0
  if (red > blue && red > green && red > 1.0) {

    green = green / red;
    blue = blue / red;
    red = 1.0;
  } else if (green > blue && green > red && green > 1.0) {

    red = red / green;
    blue = blue / green;
    green = 1.0;
  } else if (blue > red && blue > green && blue > 1.0) {

    red = red / blue;
    green = green / blue;
    blue = 1.0;
  }

  // Reverse gamma correction
  red 	= red <= 0.0031308 ? 12.92 * red : (1.0 + 0.055) * Math.pow(red, (1.0 / 2.4)) - 0.055;
  green 	= green <= 0.0031308 ? 12.92 * green : (1.0 + 0.055) * Math.pow(green, (1.0 / 2.4)) - 0.055;
  blue 	= blue <= 0.0031308 ? 12.92 * blue : (1.0 + 0.055) * Math.pow(blue, (1.0 / 2.4)) - 0.055;

  // Convert normalized decimal to decimal
  red 	= Math.round(red * 255);
  green 	= Math.round(green * 255);
  blue 	= Math.round(blue * 255);

  if (isNaN(red)) {
    red = 0;
  }

  if (isNaN(green)) {
    green = 0;
  }

  if (isNaN(blue)) {
    blue = 0;
  }

  return [red, green, blue];
}

/**
 * Converts RGB color space to CIE color space
 * @param {Number} red
 * @param {Number} green
 * @param {Number} blue
 * @return {Array} Array that contains the CIE color values for x and y
 */
export function rgb_to_cie(red: number, green: number, blue: number): Array<number> {
  // Apply a gamma correction to the RGB values, which makes the color more vivid and more the like the color displayed on the screen of your device
  red 	= (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);
  green 	= (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
  blue 	= (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);

  // RGB values to XYZ using the Wide RGB D65 conversion formula
  const X 		= red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const Y 		= red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const Z 		= red * 0.000088 + green * 0.072310 + blue * 0.986039;

  // Calculate the xy values from the XYZ values
  let x 		= Number((X / (X + Y + Z)).toFixed(4));
  let y 		= Number((Y / (X + Y + Z)).toFixed(4));

  if (isNaN(x)) {
    x = 0;
  }

  if (isNaN(y)) {
    y = 0;
  }

  return [x, y];
}
