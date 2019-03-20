const { spawn } = require('child_process')
const stream = require('stream')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

module.exports.handler = (event, context, callback) => {
  callback()
  const message = JSON.parse(event.Records[0].Sns.Message)
  const {
    bucket: { name: Bucket },
    object: { key: Key },
  } = message.Records[0].s3
  const fileURL = `https://s3.${process.env.REGION}.amazonaws.com/${Bucket}/${Key}`
  const outputFileName = `${Key.substr(0, Key.lastIndexOf('.'))}.gif`
  const ffmpeg = '/opt/mpeg/ffmpeg'
  const ffmpegArgs = ['-i', fileURL, '-t', '2', '-r', '5', '-f', 'gif', '-']

  function uploadFromStream() {
    const pass = new stream.PassThrough()
    const params = { 
      Bucket: process.env.BUCKET_GIF,
      Key: outputFileName,
      Body: pass,
      ContentDisposition: `inline; filename="${outputFileName}"`,
      ContentType: 'image/gif',
    }
    s3.upload(params, (err, data) => {
      if (data) console.log({ data })
      else console.log({ err })
    })
    return pass
  }


  function createLog() {
    const pass = new stream.PassThrough()
    const params = {
      Bucket: process.env.BUCKET_GIF,
      Key: `${outputFileName}.log`,
      Body: pass,
      ContentDisposition: `inline; filename="${outputFileName}.log"`,
      ContentType: 'text/plain',
    }
    s3.upload(params, (err, data) => {
      if (data) console.log({ data })
      else console.log({ err })
    })
    return pass
  }
  const ffProcess = spawn(ffmpeg, ffmpegArgs)
  ffProcess.stdout.pipe(uploadFromStream())
  ffProcess.stderr.pipe(createLog())
  ffProcess.on('close', status => console.log('ffmpeg process closed with status: ', status))
}
