const { spawn } = require('child_process')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const stream = require('stream')

module.exports.run = (event, context, callback) => {
  callback()
  const message = JSON.parse(event.Records[0].Sns.Message)
  const {
    bucket: { name: Bucket },
    object: { key: Key },
  } = message.Records[0].s3
  const fileURL = `https://s3.${process.env.REGION}.amazonaws.com/${Bucket}/${Key}`
  const watermarkURL = 'https://s3.eu-central-1.amazonaws.com/static.1-1-1.world/watermark.png'
  const outputFileName = `${Key.substr(0, Key.lastIndexOf('.'))}-mobile.jpg`
  // const logFileName = `${outputFileName}.log`

  const ffmpeg = '/opt/ffmpeg/ffmpeg' // Bug in serverless omits first two characters
  const ffmpegArgs = [
    '-ss',
    '1',
    '-i',
    fileURL,
    '-i',
    watermarkURL,
    '-filter_complex',
    '[1]lut=a=val*1[a];[0][a]overlay=38:146',
    '-vframes',
    '1',
    '-f',
    'mjpeg',
    '-',
  ]

  const uploadFromStream = size => {
    const pass = new stream.PassThrough()
    const params = {
      Bucket: process.env.BUCKET_WATERMARKED,
      Key: outputFileName,
      Body: pass,
      ContentDisposition: `inline; filename="${outputFileName.replace('"', "'")}"`,
      ContentType: 'image/jpeg',
    }
    s3.upload(params, (err, data) => {
      if (err) return console.log({ err })
      console.log({ data })
    })
    return pass
  }

  const ffProcess = spawn(ffmpeg, ffmpegArgs)
  ffProcess.stdout.pipe(uploadFromStream())
  // ffProcess.stderr.pipe(createErrorLog())
  ffProcess.on('close', code => console.log('ff process closed with code: ', code))

  // function createErrorLog() {
  //   const pass = new stream.PassThrough()
  //   const params = {
  //     Bucket: process.env.BUCKET_WATERMARKED,
  //     Key: logFileName,
  //     Body: pass,
  //     ContentDisposition: `inline; filename="${logFileName.replace('"', "'")}"`,
  //     ContentType: 'text/plain',
  //   }
  //   s3.upload(params, (err, data) => {
  //     if (err) return console.log('Error uploading logs to S3:', err)
  //     console.log('Error log successfully uploaded: ', data)
  //   })
  //   return pass
  // }
}
