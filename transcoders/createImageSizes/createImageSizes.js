const { spawn } = require('child_process')
const stream = require('stream')
const https = require('https')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

module.exports.handler = (event, context, callback) => {
  callback()
  const data = JSON.parse(event.body)  
  const { imageUrl } = data
  const sizes = ['5x5', '10x10', '500x500', '700x700', '1000x1000']
  const outputFileName = `${imageUrl.split('/').pop().split('.')[0]}`

  process.env['IM_PATH'] = '/opt/aphicsmagick/bin/'
  process.env['LD_LIBRARY_PATH'] = '/opt/aphicsmagick/lib'
  process.env['DYLD_LIBRARY_PATH'] = '/opt/aphicsmagick/lib'
  process.env['MAGICK_HOME'] = '/opt/aphicsmagick/'

  const graphicsmagick = '/opt/aphicsmagick/bin/gm'
  const graphicsmagickArgs = size => [
    'convert',
    '-',
    '-resize', size,
    'jpg:-'
  ]

  const createSizes = (res, size) => new Promise((resolve, reject) => {
    const pass = new stream.PassThrough()
    const gmProcess = spawn(graphicsmagick, graphicsmagickArgs(size))
    gmProcess.stdout.pipe(uploadFromStream(size, resolve, reject))
    res.pipe(pass)
    pass.pipe(gmProcess.stdin)
  }).catch(err => console.log('ERR', err))

  const uploadFromStream = (size, resolve, reject) => {
    const pass = new stream.PassThrough()
    const params = {Bucket:  process.env.BUCKET_IMAGE_SIZES, Key: `${outputFileName}-${size}.jpg`, Body: pass}
    s3.upload(params, (err, data) => {
      if (data) {
        resolve()
        console.log({data})
      } else {
        reject(err)
        console.log({err})
      }
    })
    return pass
  }

  https.get(imageUrl, res => 
    Promise.all(sizes.map(size => createSizes(res, size)))
      .then(() => console.log('ALL DONE!'))
      .catch(err => console.log('ERR', err))
  )
}
