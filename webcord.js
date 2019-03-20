#!/usr/bin/env node

const commander = require('commander')
const puppeteer = require('puppeteer')
const devices = require('puppeteer/DeviceDescriptors');
const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const rimraf = require('rimraf')
const fs = require('fs')
const image2base64 = require('image-to-base64')
const iPad = devices['iPad']
const iPhone = devices['iPhone 6']

commander.version('1.0.0')
commander.option('-u, --url <required>', 'url of webpage')
commander.option('-c, --collection', 'create a collection of exports, or just a single mp4')
commander.option('-w, --watermark <required>', 'watermark path')
commander.option('-i, --image <required>', 'use screenshot path instead of url')
commander.option('-l, --loop', 'ping pong')
commander.option('-r, --rate [optional]', 'speed of scrolling')
commander.option('-p, --position [optional]', 'position of video inside background')
commander.option('-v, --viewport [optional]', 'viewport of window')
commander.option('-b, --background <required>', 'background color ')
commander.option('-d, --demo', 'generate video in demo mode')
commander.option('-s, --screenshot [optional]', 'generate screenshot of webpage, only')
commander.parse(process.argv)

const desktopConfig = {
  emulate: false,
  viewport: { width: 1280, height: 960 },
  speeds: { slow: 10, medium: 25, fast: 40 }
}
const tabletConfig = {
  emulate: iPad,
  speeds: { slow: 5, medium: 15, fast: 40 }
};
const phoneConfig = {
  emulate: iPhone,
  speeds: { slow: 5, medium: 20, fast: 50 }
};

const imageFolder = path.resolve('./images');

(async () => {
  let config
  if (commander.viewport == 'phone') config = phoneConfig
  if (commander.viewport == 'tablet') config = tabletConfig
  if (commander.viewport == 'desktop') config = desktopConfig
  if (commander.screenshot) {
    try {
      await createScreenshot(commander.url, config)
      process.exit(0)
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  } else {
    if(commander.rate && commander.viewport && commander.url){
      let configuration = config
      configuration.speed = config.speeds[commander.rate]
      try {
        await createWebcordFromUrl(commander.url, configuration)
      } catch (error) {
        console.log(error)
        process.exit(1)
      }
    } else if(commander.rate && commander.viewport && commander.image) {
      let configuration = config
      configuration.speed = config.speeds[commander.rate]
      try {
        await createWebcordFromImage(commander.image, configuration)
      } catch (error) {
        console.log(error)
        process.exit(1)
      }
    } else {
      console.log('missing required command parameters')
      process.exit(1)
    }
  }
})()

async function createWebcordFromImage(image, config){
  const base64 = await image2base64(image)
  try {
    await fs.mkdir(imageFolder, () => { })
  } catch (error) {
    process.exit(1)
  }
  const browser = await puppeteer.launch({headless: true})
  const page = await browser.newPage()
  const screenHeight = config.emulate ? config.emulate['viewport'].height : config.viewport.height
  const screenWidth = config.emulate ? config.emulate['viewport'].width : config.viewport.width
  if (!config.emulate) await page.setViewport(config.viewport)
  else await page.emulate(config.emulate)
  await page.setContent(`<html><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="margin: 0; padding: 0; overflow-x: hidden;">
      <img src="data:image/png;base64, ${base64}" style="width: 100%;"/>
    </body>
  </html>`)
  const bodyHandle = await page.$('body')
  const pageHeight = await page.evaluate(body => body.scrollHeight, bodyHandle)
  const totalFrames = parseInt(((pageHeight - screenHeight) / config.speed))
  await bodyHandle.dispose()
  console.log('taking screenshots')
  console.log('taking header shots')
  if (totalFrames <= 0 || typeof (totalFrames) == 'undefined') {
    for (let index = 0; index < 310; index++) {
      await page.screenshot({
        path: imageFolder + '/' + (10 + index) + '.png'
      })
    }
  } else {
    for (let i = 0; i < 31; i++) {
      await page.screenshot({
        path: imageFolder + '/' + (10 + i) + '.png'
      })
    }
    console.log('taking page shots')
    for (let j = 0; j < totalFrames; j++) {
      await page.evaluate(({ config, j }) => {
        window.scrollBy(0, config.speed)
      }, { config, j })
      await page.screenshot({
        path: imageFolder + '/' + (40 + j) + '.png'
      })
    }
    console.log('taking footer shots')
    for (let k = 0; k < 31; k++) {
      await page.screenshot({
        path: imageFolder + '/' + ((40 + totalFrames) + k) + '.png'
      })
    }
  }
  browser.close()
  console.log('done taking screenshots')
  try {
    await buildVideo({
      viewport: { width: screenWidth, height: screenHeight },
      padding: screenWidth > 375 ? 60 : 40,
    })
    process.exit(0)
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
}

async function createScreenshot(url, config){
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  if (!config.emulate) await page.setViewport(config.viewport)
  else await page.emulate(config.emulate)
  await page.goto(url, { "waitUntil": "networkidle2", timeout: 3000000 })
  console.log('taking screenshot')
  await page.screenshot({ path: commander.screenshot, fullPage: true})
  console.log('done taking screenshot')
  browser.close()
}

async function createWebcordFromUrl(url, config){
  console.log('creating webcord from url')
  try {
    await fs.mkdir(imageFolder, () => {})
  } catch (error) {
    process.exit(1)
  }
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  const screenHeight = config.emulate ? config.emulate['viewport'].height : config.viewport.height
  const screenWidth = config.emulate ? config.emulate['viewport'].width : config.viewport.width
  if(!config.emulate) await page.setViewport(config.viewport)
  else await page.emulate(config.emulate)
  await page.goto(url, { "waitUntil": "networkidle2", timeout: 3000000 })
  const bodyHandle = await page.$('body')
  const pageHeight = await page.evaluate(body => body.scrollHeight, bodyHandle)
  const totalFrames = parseInt(((pageHeight - screenHeight) / config.speed))
  console.log(totalFrames)
  await bodyHandle.dispose()
  console.log('taking screenshots')
  console.log('taking header shots')
  await new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, 3000)
  })
  if (totalFrames <= 0 || typeof(totalFrames) == 'undefined') {
    for (let index = 0; index < 310; index++) {
      await page.screenshot({
        path: imageFolder + '/' + (10 + index) + '.png'
      })
    }
  } else {
    for (let i = 0; i < 31; i++) {
      await page.screenshot({
        path: imageFolder + '/' + (10 + i) + '.png'
      })
    }
    console.log('taking page shots')
    for (let j = 0; j < totalFrames; j++) {
      await page.evaluate(({ config, j }) => {
        window.scrollBy(0, config.speed)
      }, { config, j })
      await page.screenshot({
        path: imageFolder + '/' + (40 + j) + '.png'
      })
    }
    console.log('taking footer shots')
    for (let k = 0; k < 31; k++) {
      await page.screenshot({
        path: imageFolder + '/' + ((40 + totalFrames) + k) + '.png'
      })
    }
  }
  browser.close()
  console.log('done taking screenshots')
  try {
    await buildVideo({
      viewport: { width: screenWidth, height: screenHeight },
      padding: screenWidth > 375 ? 60 : 40,
    })
    process.exit(0)
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
}

async function buildVideo(config){
  return new Promise(async (resolve, reject) => {
    console.log('building videos')
    const size = config.viewport
    const padding = config.padding
    const padColor = commander.background
    let command = ffmpeg()
    command.addOutput(path.resolve('./video.mp4'))
    command.addInput(imageFolder + '/%02d.png')
    command.inputOptions(['-start_number 10'])
    if (commander.background) {
      let position
      if (commander.position == 'center') {
        position = '((oh-ih)/2)'
      } else if (commander.position == 'bottom') {
        position = '(oh-ih)'
      }
      // if (commander.watermark) {
      //   command.addInput(commander.watermark)
      //   if (commander.loop) {
      //     command.complexFilter(`[0:v]reverse[r];[0:v][r]concat,loop=1,setpts=N/29/TB[out];[out]scale=${size.width - (padding * 2)}:-1,pad=${size.width}:${size.height}:(ow-iw)/2:${position}:color=${padColor}[padded];[padded][1]overlay=main_w-overlay_w-15:main_h-overlay_h-15`)
      //   } else {
      //     command.complexFilter(`[0:v]scale=${size.width - (padding * 2)}:-1,pad=${size.width}:${size.height}:(ow-iw)/2:${position}:color=${padColor}[padded];[padded][1]overlay=main_w-overlay_w-15:main_h-overlay_h-15`)
      //   }
      // } else {

      // }
      if (commander.loop) {
        command.complexFilter(`[0:v]reverse[r];[0:v][r]concat,loop=1,setpts=N/29/TB[out];[out]scale=${size.width - (padding * 2)}:-1,pad=${size.width}:${size.height}:(ow-iw)/2:${position}:color=${padColor}`)
      } else {
        command.complexFilter(`[0:v]scale=${size.width - (padding * 2)}:-1,pad=${size.width}:${size.height}:(ow-iw)/2:${position}:color=${padColor}`)
      }
    } else {
      if (commander.watermark) {
        command.addInput(commander.watermark)
        if (commander.loop) {
          command.complexFilter('[0:v]reverse[r];[0:v][r]concat,loop=1,setpts=N/29/TB[out];[out][1]overlay=main_w-overlay_w-15:main_h-overlay_h-15')
        } else {
          command.complexFilter('[0][1]overlay=main_w-overlay_w-15:main_h-overlay_h-15')
        }
      } else {
        if (commander.loop) {
          command.complexFilter(['[0:v]reverse[r];[0:v][r]concat,loop=1,setpts=N/29/TB'])
        }
      }
    }
    command.outputOptions(['-c:v libx264', '-r 29', '-pix_fmt yuv420p', '-crf 10', '-threads 8'])
    command.on('end', () => {
      console.log('done building mp4')
      if (commander.collection) {
        let webmCommand = ffmpeg(path.resolve('./video.mp4'))
        webmCommand.outputOptions(['-c:v libvpx', '-f webm', '-b:v 1M'])
        webmCommand.on('error', function (stderrLine) {
          console.log('failed while building webm')
          reject(stderrLine)
        })
        webmCommand.on('stderr', function (stderrLine) {
          // console.log('Stderr output: ' + stderrLine)
        })
        webmCommand.on('end', () => {
          console.log('done building webm')
          console.log('cleaning up files')
          rimraf(imageFolder, () => {
            console.log('done building videos')
            resolve()
          })
        })
        webmCommand.save('./video.webm')
      } else {
        rimraf(imageFolder, () => {
          console.log('done building videos')
          resolve()
        })
      }
    })
    command.on('error', function (stderrLine) {
      console.log(stderrLine)
      console.log('failed while building mp4')
      reject(stderrLine)
    })
    command.on('stderr', function (stderrLine) {
      console.log('Stderr output: ' + stderrLine)
    })
    console.log('building mp4')
    command.run()
  })
}