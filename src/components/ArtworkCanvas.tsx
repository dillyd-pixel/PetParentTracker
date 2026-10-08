/**
 * Custom Pet Artwork — the on-screen canvas.
 *
 * The templates (see ../pdf/artwork/templates) describe a piece ONCE, as
 * fractions of the sheet's width, and this component draws that description with
 * React Native views — the same fractions the print template turns into CSS (see
 * ../pdf/artwork/html). It is the second of the two renderers, and it exists
 * because a WebView is not part of this stack: on a device the artwork the owner
 * is choosing is drawn here, natively, while the browser previews the real print
 * HTML in a frame.
 *
 * Geometry: every number is a fraction of the canvas WIDTH, so the same data lays
 * out a 58pt template thumbnail, a phone-sized preview and a full sheet
 * identically — exactly what the print page does with `1em = 1% of the width`.
 * The sheet's own height therefore comes from the paper (US Letter or A4), never
 * from a hard-coded ratio.
 *
 * Colour: the palette lives in the template data, so it is never repeated here.
 * The only image is the pet's OWN photo, from the device's own storage; the
 * placeholder is a plain, honest note when there is none yet.
 *
 * 100% offline: this component draws data it was handed. It fetches nothing,
 * stores nothing and never talks to a server. `gradientPoints` and `withAlpha`
 * are exported as pure helpers so the layer maths can be exercised in Node.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { ArtworkDocument } from '../pdf/artwork/document';
import {
  ARTWORK_TYPE,
  type ArtworkFrame,
  type ArtworkFrameShape,
  type ArtworkLayer,
  type ArtworkTemplate,
} from '../pdf/artwork/templates';
import { paperSizeDef } from '../pdf/planner/sections';
import { FONT_BODY, FONT_HEAD } from '../theme';

/**
 * A colour with an opacity applied: `#RRGGBB` becomes `rgba(...)`, and anything
 * that already carries its own alpha (an `rgba(...)` mat, say) is handed back
 * untouched — the same rule the print template follows.
 */
export function withAlpha(color: string, opacity: number): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.round(opacity * 1000) / 1000})`;
  }
  return hex;
}

/**
 * "Fill the canvas, absolutely" — written out rather than spread from the sheet,
 * so nothing here depends on how a registered style object behaves.
 */
const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/** A point on the canvas, in 0–1 coordinates of the box. */
export interface GradientPoint {
  x: number;
  y: number;
}

/**
 * A CSS gradient angle as the two points `expo-linear-gradient` wants, so a
 * backdrop reads the same on screen as it does on the printed sheet.
 *
 * CSS measures the angle clockwise from "to top" (0deg = the first colour at the
 * bottom, the second at the top; 180deg = the reverse). The direction vector is
 * therefore `(sin θ, −cos θ)` in screen coordinates (y grows downwards), and the
 * gradient runs from one side of the centre to the other along it.
 */
export function gradientPoints(angleDeg: number): { start: GradientPoint; end: GradientPoint } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  return {
    start: { x: clamp(0.5 - dx / 2), y: clamp(0.5 - dy / 2) },
    end: { x: clamp(0.5 + dx / 2), y: clamp(0.5 + dy / 2) },
  };
}

/**
 * The corner treatment of one box, in points: a circle takes half the box, an
 * arch takes a half-round top over square-ish feet, and a square frame takes the
 * soft printed corner it is given.
 */
function boxRadii(
  shape: ArtworkFrameShape,
  cornerPx: number,
  width: number,
  height: number,
): ViewStyle {
  const half = Math.min(width, height) / 2;
  if (shape === 'circle') return { borderRadius: half };
  if (shape === 'arch') {
    return {
      borderTopLeftRadius: width / 2,
      borderTopRightRadius: width / 2,
      borderBottomLeftRadius: cornerPx,
      borderBottomRightRadius: cornerPx,
    };
  }
  return { borderRadius: Math.min(cornerPx, half) };
}

/** The soft drop under the frame — the sheet's `box-shadow`, in points. */
function frameShadow(frame: ArtworkFrame, width: number): ViewStyle {
  return {
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: Math.max(1, 0.1 * frame.depth * width) },
    shadowOpacity: Math.min(1, frame.depth),
    shadowRadius: Math.max(2, 0.11 * frame.depth * width),
    elevation: frame.depth > 0.3 ? 6 : 3,
  };
}

/** One decorative layer, drawn where the template puts it. */
function Layer({
  layer,
  width,
  height,
}: {
  layer: ArtworkLayer;
  width: number;
  height: number;
}): React.JSX.Element | null {
  switch (layer.kind) {
    case 'blob': {
      // Three concentric translucent discs read as the print sheet's one soft
      // radial wash — the same shape, without needing a blur dependency.
      const size = layer.size * width;
      return (
        <View
          style={[
            styles.layer,
            {
              left: layer.x * width,
              top: layer.y * height,
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <View
            style={[
              styles.layer,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: withAlpha(layer.color, layer.opacity * 0.26),
              },
            ]}
          />
          <View
            style={{
              width: size * 0.74,
              height: size * 0.74,
              borderRadius: (size * 0.74) / 2,
              backgroundColor: withAlpha(layer.color, layer.opacity * 0.62),
            }}
          />
          <View
            style={{
              width: size * 0.46,
              height: size * 0.46,
              borderRadius: (size * 0.46) / 2,
              backgroundColor: withAlpha(layer.color, layer.opacity),
            }}
          />
        </View>
      );
    }
    case 'beam': {
      const length = layer.width * width;
      const thickness = length / Math.max(1, layer.aspect);
      const colors: [string, string, string] = [
        withAlpha(layer.color, 0),
        withAlpha(layer.color, layer.opacity),
        withAlpha(layer.color, 0),
      ];
      return (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            position: 'absolute',
            left: layer.x * width,
            top: layer.y * height,
            width: length,
            height: thickness,
            borderRadius: thickness / 2,
            transform: [{ rotate: `${layer.rotate}deg` }],
          }}
        />
      );
    }
    case 'glyph':
      return (
        <Text
          style={[
            styles.layer,
            {
              left: layer.x * width,
              top: layer.y * height,
              fontSize: layer.size * width,
              lineHeight: layer.size * width * 1.18,
              color: layer.color,
              opacity: layer.opacity,
              transform: layer.rotate ? [{ rotate: `${layer.rotate}deg` }] : undefined,
            },
          ]}
        >
          {layer.glyph}
        </Text>
      );
    case 'dot': {
      const size = layer.size * width;
      return (
        <View
          style={[
            styles.layer,
            {
              left: layer.x * width,
              top: layer.y * height,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: withAlpha(layer.color, layer.opacity),
            },
          ]}
        />
      );
    }
    case 'vignette': {
      // Four edge bands — the primitive both renderers have, so the screen and
      // the sheet darken their edges in the same way.
      const dark = withAlpha('#000000', layer.strength);
      const clear = withAlpha('#000000', 0);
      const reach = layer.reach * (width < height ? width : height) * 0.6;
      return (
        <>
          <LinearGradient
            colors={[dark, clear]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.layer, { left: 0, right: 0, top: 0, height: reach }]}
          />
          <LinearGradient
            colors={[dark, clear]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={[styles.layer, { left: 0, right: 0, bottom: 0, height: reach }]}
          />
          <LinearGradient
            colors={[dark, clear]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.layer, { top: 0, bottom: 0, left: 0, width: reach }]}
          />
          <LinearGradient
            colors={[dark, clear]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={[styles.layer, { top: 0, bottom: 0, right: 0, width: reach }]}
          />
        </>
      );
    }
    default:
      return null;
  }
}

/** The pet's name, the accent rule, the owner's words and the small-caps line. */
function CaptionBlock({
  doc,
  template,
  width,
  centered = true,
}: {
  doc: ArtworkDocument;
  template: ArtworkTemplate;
  width: number;
  centered?: boolean;
}): React.JSX.Element {
  const align = centered ? 'center' : 'left';
  return (
    <View style={{ alignItems: centered ? 'center' : 'flex-start' }}>
      <Text
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: '700',
          fontSize: ARTWORK_TYPE.name * width,
          lineHeight: ARTWORK_TYPE.name * width * 1.16,
          color: template.ink,
          textAlign: align,
        }}
      >
        {doc.petName}
      </Text>
      <View
        style={{
          width: ARTWORK_TYPE.ruleWidth * width,
          height: Math.max(1, ARTWORK_TYPE.ruleHeight * width),
          borderRadius: 999,
          backgroundColor: template.accent,
          marginTop: ARTWORK_TYPE.kicker * width,
        }}
      />
      {doc.caption ? (
        <Text
          style={{
            fontFamily: FONT_BODY,
            fontSize: ARTWORK_TYPE.caption * width,
            lineHeight: ARTWORK_TYPE.caption * width * 1.35,
            color: template.inkSoft,
            textAlign: align,
            marginTop: ARTWORK_TYPE.kicker * width * 0.5,
          }}
        >
          {doc.caption}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: FONT_BODY,
          fontSize: ARTWORK_TYPE.kicker * width,
          letterSpacing: ARTWORK_TYPE.kicker * width * 0.16,
          textTransform: 'uppercase',
          color: template.inkSoft,
          textAlign: align,
          marginTop: ARTWORK_TYPE.kicker * width * 0.45,
        }}
      >
        {doc.kicker}
      </Text>
    </View>
  );
}

export interface ArtworkCanvasProps {
  /** The piece to draw (from `buildArtworkDocument`). */
  doc: ArtworkDocument;
  /** How wide the canvas is, in points. The height follows the sheet's ratio. */
  width: number;
  /**
   * The pet's photo as something this platform can draw: the device's own file
   * URI, or the picked URI in a browser. Null draws the honest note instead.
   */
  photoUri?: string | null;
  /** Draw the quiet line at the foot of the sheet (off for thumbnails). */
  footer?: boolean;
  /** Draw the "a photo goes here" note when there is no photo (off for thumbs). */
  placeholder?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One finished piece of artwork, drawn natively. */
export function ArtworkCanvas({
  doc,
  width,
  photoUri,
  footer = true,
  placeholder = true,
  style,
}: ArtworkCanvasProps): React.JSX.Element {
  const template = doc.template;
  const size = paperSizeDef(doc.paper);
  /** The sheet's own proportions — the canvas is a page, not a square. */
  const height = width * (size.heightMm / size.widthMm);
  const below = template.frame.captionPlacement === 'below';
  const frame = template.frame;
  const frameWidth = frame.width * width;
  const frameHeight = frameWidth / frame.aspect;
  const mat = frame.mat * width;
  const innerWidth = Math.max(1, frameWidth - mat * 2);
  const gradient = gradientPoints(template.backdrop.angle);

  return (
    <View
      style={[
        styles.canvas,
        { width, height, backgroundColor: template.backdrop.colors[0] },
        style,
      ]}
      accessibilityLabel={`${doc.petName} — ${template.title}`}
    >
      {/* the wash behind everything */}
      <LinearGradient
        colors={[template.backdrop.colors[0], template.backdrop.colors[1]]}
        start={gradient.start}
        end={gradient.end}
        style={[FILL, { borderRadius: 0 }]}
      />
      {template.layers.map((layer, index) => (
        <Layer key={index} layer={layer} width={width} height={height} />
      ))}

      {/* the stage: the frame sits centred, lifted when the words sit below it */}
      <View
        style={[
          FILL,
          {
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: below ? ARTWORK_TYPE.stageLift * height : 0,
          },
        ]}
      >
        <View
          style={[
            {
              width: frameWidth,
              height: frameHeight,
              backgroundColor: frame.matColor,
              padding: mat,
              transform: [{ rotate: `${frame.tilt}deg` }],
            },
            boxRadii(frame.shape, 0.014 * width, frameWidth, frameHeight),
            frameShadow(frame, width),
          ]}
        >
          <View
            style={[
              {
                flex: 1,
                overflow: 'hidden',
                backgroundColor: '#F1E9DC',
                borderWidth: Math.max(2, frame.ring.width * width),
                borderColor: frame.ring.color,
              },
              boxRadii(frame.shape, 0.009 * width, innerWidth, innerWidth / frame.aspect),
            ]}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photo}
                resizeMode="cover"
                accessibilityLabel={`${doc.petName}'s photo`}
              />
            ) : placeholder ? (
              <View style={styles.placeholder}>
                <Text
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: ARTWORK_TYPE.caption * width,
                    lineHeight: ARTWORK_TYPE.caption * width * 1.4,
                    color: template.inkSoft,
                    textAlign: 'center',
                  }}
                >
                  A photo of {doc.petName} goes here — add one on their page and it prints in this
                  frame.
                </Text>
              </View>
            ) : null}
          </View>

          {frame.strip ? (
            <View
              style={{
                height: frame.stripHeight * width,
                paddingHorizontal: ARTWORK_TYPE.stripPad * width,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CaptionBlock doc={doc} template={template} width={width} />
            </View>
          ) : null}
        </View>
      </View>

      {/* the words, when they sit below the frame rather than in a strip */}
      {below ? (
        <View
          style={{
            position: 'absolute',
            left: ARTWORK_TYPE.blockInset * width,
            right: ARTWORK_TYPE.blockInset * width,
            bottom: ARTWORK_TYPE.blockBottom * height,
            alignItems: 'center',
          }}
        >
          <CaptionBlock doc={doc} template={template} width={width} />
        </View>
      ) : null}

      {footer ? (
        <Text
          style={{
            position: 'absolute',
            left: 0.06 * width,
            right: 0.06 * width,
            bottom: ARTWORK_TYPE.footerBottom * height,
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: ARTWORK_TYPE.footer * width,
            lineHeight: ARTWORK_TYPE.footer * width * 1.35,
            color: template.footerInk,
          }}
        >
          {doc.footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative', overflow: 'hidden' },
  /** A layer: absolutely placed, sized by the caller. */
  layer: { position: 'absolute' },
  photo: { width: '100%', height: '100%' },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8%',
  },
});
