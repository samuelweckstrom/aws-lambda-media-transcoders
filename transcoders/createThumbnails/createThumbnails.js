const { spawn } = require('child_process')
const stream = require('stream')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

module.exports.run = async (event, context, callback) => {
  callback()
  const message = JSON.parse(event.Records[0].Sns.Message)
  const {
    bucket: { name: Bucket },
    object: { key: Key },
  } = message.Records[0].s3
  const fileURL = `https://s3.${process.env.REGION}.amazonaws.com/${Bucket}/${Key}`
  const outputFileName = `${Key.substr(0, Key.lastIndexOf('.'))}-thumbnail.jpg`

  function uploadFromStream() {
    const pass = new stream.PassThrough()
    const params = { Bucket: process.env.BUCKET_THUMBNAILS, Key: outputFileName, Body: pass }
    s3.upload(params, (err, data) => {
      if (data) console.log({ data })
      else console.log({ err })
    })
    return pass
  }

  const ffmpeg = '/opt/ffmpeg/ffmpeg'
  const ffmpegArgs = ['-ss', '1', '-i', fileURL, '-f', 'mjpeg', '-vframes', '1', '-']

  const ff = spawn(ffmpeg, ffmpegArgs)
  ff.stdout.pipe(uploadFromStream())
  ff.on('close', code => console.log('ff process closed with code: ', code))
}
