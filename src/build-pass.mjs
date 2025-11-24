import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import dotenv from 'dotenv';
import forge from 'node-forge';
import { PKPass } from 'passkit-generator';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PASS_TEMPLATE_DIR = path.join(ROOT_DIR, 'pass');
const CERTS_DIR = path.join(ROOT_DIR, 'certs');
const TEMP_DIR = path.join(ROOT_DIR, '.pass-build');
const MODEL_DIR = path.join(TEMP_DIR, 'business-card.pass');
const OUTPUT_PATH = path.join(ROOT_DIR, 'output', 'hiro_business_card.pkpass');
const P12_PATH = path.join(CERTS_DIR, 'pass_certificate.p12');
const WWDR_PATH = path.join(CERTS_DIR, 'AppleWWDRCA.pem');

async function main() {
  try {
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.rm(TEMP_DIR, { recursive: true, force: true });

    const passphrase = requireEnv('PASS_CERT_PASSWORD');
    const wwdr = await readFileOrThrow(WWDR_PATH, 'Apple WWDR CA 証明書 (PEM)');
    const { signerCert, signerKey } = await extractCertificatePair(P12_PATH, passphrase);
    await copyTemplateToModel();

    const pass = await PKPass.from({
      model: MODEL_DIR,
      certificates: {
        wwdr,
        signerCert,
        signerKey,
      },
    });

    // QRコードを設定（Wallet に表示される部分）
pass.setBarcodes({
  message: "https://minimalist-hiro-app.com/",
  format: "PKBarcodeFormatQR",
  messageEncoding: "utf-8",
});


    await appendAssets(pass);
    await writePass(pass);

    console.log(`✓ Pass generated at ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Failed to build pass:', error);
    process.exit(1);
  } finally {
    await fs.rm(TEMP_DIR, { recursive: true, force: true }).catch(() => {});
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set.`);
  }
  return value;
}

async function readFileOrThrow(filePath, label) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`${label} を ${filePath} に配置してください.`);
  }
}

async function extractCertificatePair(p12Path, passphrase) {
  const p12Buffer = await readFileOrThrow(p12Path, 'Pass Type ID 証明書 (.p12)');
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const key = getFirstKey(p12);
  const cert = getFirstCertificate(p12);

  return {
    signerCert: Buffer.from(forge.pki.certificateToPem(cert)),
    signerKey: Buffer.from(forge.pki.privateKeyToPem(key)),
  };
}

function getFirstKey(p12) {
  const keyBagTypes = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag];
  for (const type of keyBagTypes) {
    const bags = p12.getBags({ bagType: type })[type];
    if (bags && bags.length && bags[0].key) {
      return bags[0].key;
    }
  }
  throw new Error('.p12 内にプライベートキーが見つかりませんでした。');
}

function getFirstCertificate(p12) {
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const certBag = certBags.find((bag) => bag.cert);
  if (!certBag) {
    throw new Error('.p12 内に証明書が見つかりませんでした。');
  }
  return certBag.cert;
}

async function copyTemplateToModel() {
  await copyDirectory(PASS_TEMPLATE_DIR, MODEL_DIR);
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    })
  );
}

async function appendAssets(pass) {
  const iconPath = path.join(ROOT_DIR, 'assets', 'icon.png');
  const logoPath = path.join(ROOT_DIR, 'assets', 'logo.png');
  const [icon, logo] = await Promise.all([
    readFileOrThrow(iconPath, 'icon.png'),
    readFileOrThrow(logoPath, 'logo.png'),
  ]);
  pass.addBuffer('icon.png', icon);
  pass.addBuffer('icon@2x.png', icon);
  pass.addBuffer('logo.png', logo);
  pass.addBuffer('logo@2x.png', logo);
}

async function writePass(pass) {
  const stream = pass.getAsStream();
  const output = createWriteStream(OUTPUT_PATH);
  await pipeline(stream, output);
}

main();
