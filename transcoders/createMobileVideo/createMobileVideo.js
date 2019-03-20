const { spawn } = require('child_process')
const stream = require('stream')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const request = require('request')
const fs = require('fs')

module.exports.run = async (event, context, callback) => {
  callback()
  const message = JSON.parse(event.Records[0].Sns.Message)
  const {
    bucket: { name: Bucket },
    object: { key: Key },
  } = message.Records[0].s3
  const fileURL = `https://s3.${process.env.REGION}.amazonaws.com/${Bucket}/${Key}`
  const tempFileName = `${Key.substr(0, Key.lastIndexOf('.'))}-temp.mp4`
  const outputFileName = `${Key.substr(0, Key.lastIndexOf('.'))}-mobile.mp4`
  const logFileName = `${outputFileName}.log`
  const logFileNameError = `${outputFileName}-error.log`

  const tempInputFile = `/tmp/${tempFileName}`
  const tempOutputFile = `/tmp/${outputFileName}`
  const ffmpeg = '/opt/ffmpeg/ffmpeg'
  const ffmpegArgs = ['-i', tempInputFile, '-c:v', 'copy', '-f', 'mp4', tempOutputFile]

  const getFile = async () => {
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempInputFile)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      request(fileURL).pipe(writeStream)
    })
  }

  const transcodeVideo = async () => {
    await new Promise((resolve, reject) => {
      const ffProcess = spawn(ffmpeg, ffmpegArgs)
      // ffProcess.stdout.pipe(createOutputLog())
      ffProcess.stderr.pipe(createErrorLog())
      ffProcess.on('close', code => {
        console.log('ffmpeg process closed with code: ', code)
        resolve()
      })
      ffProcess.on('error', error => reject(error))
    })
  }

  const removeTempFiles = () =>
    [tempInputFile, tempOutputFile].forEach(filename => fs.exists(filename) && fs.unlink(filename))

  const uploadFile = async () => {
    const params = {
      Bucket: process.env.BUCKET_MOBILE_VIDEO,
      Key: outputFileName,
      Body: fs.createReadStream(tempOutputFile),
      ContentDisposition: `inline; filename="${outputFileName.replace('"', "'")}"`,
      ContentType: 'video/mp4',
    }
    await s3.upload(params).promise()
  }

  try {
    await getFile()
    await transcodeVideo()
    await uploadFile()
    removeTempFiles()
  } catch (error) {
    console.log('ERROR TRANSCODING VIDEO', error)
  }

  function createErrorLog() {
    const pass = new stream.PassThrough()
    const params = {
      Bucket: process.env.BUCKET_MOBILE_VIDEO,
      Key: logFileNameError,
      Body: pass,
      ContentDisposition: `inline; filename="${logFileNameError.replace('"', "'")}"`,
      ContentType: 'text/plain',
    }
    s3.upload(params, (err, data) => {
      if (err) return console.log('Error uploading logs to S3:', err)
      console.log('Error log successfully uploaded: ', data)
    })
    return pass
  }

  function createOutputLog() {
    const pass = new stream.PassThrough()
    const params = {
      Bucket: process.env.BUCKET_MOBILE_VIDEO,
      Key: logFileName,
      Body: pass,
      ContentDisposition: `inline; filename="${logFileName.replace('"', "'")}"`,
      ContentType: 'text/plain',
    }
    s3.upload(params, (err, data) => {
      if (err) return console.log('Error uploading logs to S3:', err)
      console.log('Logs successfully uploaded: ', data)
    })
    return pass
  }
}
