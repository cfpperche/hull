import { Fragment, type ReactNode } from "react";
import type { Segment, T } from "@hull/i18n";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button as ReactEmailButton,
} from "@react-email/components";
import { color, font, radius, width } from "./tokens";
import { V } from "./vars";

/**
 * The shell every message wears.
 *
 * It mirrors `AuthScreen` from `@hull/ui`: mark, then a large tight title, then
 * muted supporting copy, then the action. Somebody clicking a link should not
 * feel they changed products between the mail and the page it opens.
 */
export function Layout({
  t,
  title,
  preview,
  lead,
  children,
}: {
  /** The catalog for the locale being rendered. Every message is rendered once
   *  per locale at build time, so this is a build-time value, never a runtime one. */
  t: T;
  title: string;
  /** The line the inbox shows beside the subject. Left unset, clients take
   *  whatever text comes first — which here would be the brand name, on every
   *  message, which tells the reader nothing. */
  preview: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Html lang={t.locale}>
      <Head>
        {/* Stops the aggressive auto-inverters from inventing a dark mode on our
            behalf. There is only a light design here, deliberately:
            prefers-color-scheme works in Apple Mail and almost nowhere else, and
            a half-supported dark mode reads as a bug in the clients that ignore it. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: color.ground }}>
        <Section style={{ backgroundColor: color.ground, padding: "32px 16px" }}>
          <Container
            style={{
              width: "100%",
              maxWidth: `${width}px`,
              backgroundColor: color.surface,
              border: `1px solid ${color.border}`,
              borderRadius: radius.lg,
              padding: "24px",
            }}
          >
            <Mark />
            <Heading
              as="h1"
              style={{
                // 4px when a lead follows, because the lead carries the gap;
                // 20px when none does, or the first block sits against the
                // title's baseline. The reset mail found this the hard way.
                margin: lead ? "24px 0 4px" : "24px 0 20px",
                fontFamily: font,
                fontSize: "22px",
                lineHeight: "28px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: color.foreground,
              }}
            >
              {title}
            </Heading>
            {lead ? (
              <Text
                style={{
                  margin: "0 0 24px",
                  fontFamily: font,
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: color.mutedForeground,
                }}
              >
                {lead}
              </Text>
            ) : null}
            {children}
          </Container>
          <Text
            style={{
              margin: "16px auto 0",
              maxWidth: `${width}px`,
              fontFamily: font,
              fontSize: "12px",
              lineHeight: "18px",
              color: color.mutedForeground,
            }}
          >
            {t("mail.footer", { brand: V.brand, host: V.host })}
          </Text>
        </Section>
      </Body>
    </Html>
  );
}

/** The brand mark, drawn rather than fetched: a remote image is blocked by
 *  default in most clients, so a hosted logo becomes a broken-image icon. */
function Mark() {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td
            width={28}
            height={28}
            align="center"
            // bgcolor, not a CSS background: Outlook's table renderer honours
            // the attribute and drops the property. React's DOM types stop at
            // HTML5, which is why this arrives by spread.
            {...({ bgcolor: color.foreground } as Record<string, string>)}
            // The letter is decoration. Spelled out in the plain-text half it
            // reads as a stutter — "HHull" — so the converter skips it.
            data-plain-text="skip"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: radius.md,
              fontFamily: font,
              fontSize: "12px",
              fontWeight: 600,
              color: color.surface,
            }}
          >
            {V.mark}
          </td>
          <td
            style={{
              paddingLeft: "10px",
              fontFamily: font,
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: color.foreground,
            }}
          >
            {V.brand}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function P({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontFamily: font,
        fontSize: "14px",
        lineHeight: "22px",
        color: muted ? color.mutedForeground : color.foreground,
      }}
    >
      {children}
    </Text>
  );
}

export function Button({ href, children }: { href: string; children: string }) {
  return (
    <ReactEmailButton
      href={href}
      // Skipped in the plain-text half: the URL is printed below it either way,
      // and "Confirm email https://…" followed by the same link again reads as
      // a mistake.
      data-plain-text="skip"
      style={{
        display: "inline-block",
        margin: "0 0 16px",
        padding: "11px 18px",
        backgroundColor: color.primary,
        borderRadius: radius.lg,
        fontFamily: font,
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: "18px",
        color: color.primaryForeground,
        textDecoration: "none",
      }}
    >
      {children}
    </ReactEmailButton>
  );
}

/**
 * The raw URL, spelled out under every button.
 *
 * Clients strip links, corporate gateways rewrite them, and someone reading on a
 * phone may want to finish on a laptop. It also carries the plain-text half:
 * `render(..., { plainText: true })` keeps visible text, so this is what puts a
 * usable URL in the message a text-only reader gets.
 */
export function FallbackLink({ t, href }: { t: T; href: string }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontFamily: font,
        fontSize: "13px",
        lineHeight: "20px",
        color: color.mutedForeground,
      }}
    >
      <span data-plain-text="skip">
        {t("mail.orPaste")}
        <br />
      </span>
      <Link href={href} style={{ color: color.mutedForeground, wordBreak: "break-all" }}>
        {href}
      </Link>
    </Text>
  );
}

export function Divider() {
  return <Hr style={{ margin: "0 0 16px", border: "none", borderTop: `1px solid ${color.border}` }} />;
}

/**
 * A translated sentence whose holes take nodes rather than text.
 *
 * Half the messages name an address and want it in bold. The alternative is
 * splitting the sentence around the bold part, which is exactly the fragment key
 * ADR-0016 refuses: word order is the translator's to change, and they cannot
 * change it if the sentence arrives in three pieces.
 */
export function Fill({ parts, nodes }: { parts: Segment[]; nodes: Record<string, ReactNode> }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          // A hole with no node is left standing, for the same reason `fill`
          // leaves one standing: "{oldEmail}" is a bug somebody reports, an
          // empty gap is one that ships.
          <Fragment key={i}>{nodes[part.hole] ?? `{${part.hole}}`}</Fragment>
        ),
      )}
    </>
  );
}
