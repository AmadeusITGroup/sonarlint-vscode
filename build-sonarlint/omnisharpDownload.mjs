/* --------------------------------------------------------------------------------------------
 * SonarLint for VisualStudio Code
 * Copyright (C) 2017-2025 SonarSource SA
 * sonarlint@sonarsource.com
 * Licensed under the LGPLv3 License. See LICENSE.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { ensureDir } from 'fs-extra';
import { error, info } from 'fancy-log';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { createGunzip } from 'node:zlib';
import { basename } from 'path';
import { extract } from 'tar';
import { parse } from 'url';

import artifactory from './artifactory.mjs';
import { downloadFile } from './downloadUtil.mjs';
import { deleteFile } from './fsUtils.mjs';

export const omnisharpPlatformMapping = {
  'linux-arm64': 'mono',
  'linux-x64': 'mono',
  'darwin-arm64': 'mono',
  'darwin-x64': 'mono',
  'win32-x64': 'net472'
};

export async function downloadAndExtractOmnisharp(omnisharpVersion, omnisharpDistribution) {
  ensureDir('./omnisharp', err => {
    if (err) {
      error(`Error while ensuring existence of ./omnisharp folder.${err}`);
    }
  });

  info(`Downloading omnisharp ${omnisharpDistribution}`);

  const omnisharpDownloadUrl = `${artifactory.repoRoot}/org/sonarsource/sonarlint/omnisharp/omnisharp-roslyn/${omnisharpVersion}/omnisharp-roslyn-${omnisharpVersion}-${omnisharpDistribution}.tar.gz`;
  const parsedDownloadUrl = parse(omnisharpDownloadUrl);
  const omnisharpFileName = basename(parsedDownloadUrl.pathname).replace(/\.(?:7z|bz2|gz|rar|tar|zip|xz)*$/, '');

  await downloadFile(omnisharpDownloadUrl, `./omnisharp/${omnisharpFileName}`, true);

  const inputFilePath = `./omnisharp/${omnisharpFileName}`;
  const outputFolderPath = `./omnisharp/${omnisharpDistribution}`;
  if (!existsSync(outputFolderPath)) {
    mkdirSync(outputFolderPath);
  }

  const compressedReadStream = createReadStream(inputFilePath);
  const decompressionStream = createGunzip();
  const extractionStream = extract({
    cwd: outputFolderPath // Set the current working directory for extraction
  });
  compressedReadStream.pipe(decompressionStream).pipe(extractionStream);

  return new Promise((resolve, reject) => {
    extractionStream.on('finish', () => {
      info(`Successfully extracted OmniSharp ${omnisharpDistribution} into ${outputFolderPath}`);
      deleteFile(inputFilePath);
      resolve();
    });
    compressedReadStream.on('error', err => {
      error('Error reading compressed file:', err);
      reject(err);
    });
    decompressionStream.on('error', err => {
      error('Error decompressing:', err);
      reject(err);
    });
    extractionStream.on('error', err => {
      error('Error extracting:', err);
      reject(err);
    });
  });
}

export async function downloadOmnisharpAllPlatformDistributions(omnisharpVersion) {
  await downloadAndExtractOmnisharp(omnisharpVersion, 'mono');
  await downloadAndExtractOmnisharp(omnisharpVersion, 'net472');
  await downloadAndExtractOmnisharp(omnisharpVersion, 'net6');
}
