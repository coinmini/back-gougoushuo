'use strict'

var qiniu = require('qiniu')
// const proc = require("process")
var config = require('../../config/config')
var cloudinary = require('cloudinary')
var sha1 =require('sha1')
var uuid = require('uuid')
var Promise = require('bluebird')  //把普通的回调函数包装成promise，就可以把返回的结果 给调用这个promise的 函数加 .then

var accessKey = config.qiniu.AK
var secretKey = config.qiniu.SK
var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

//以下是 qiniu.fetch用到的，从github来的https://github.com/qiniu/nodejs-sdk/blob/master/examples/rs_fetch.js
var qiniu_config = new qiniu.conf.Config()
//config.useHttpsDomain = true;
//config.zone = qiniu.zone.Zone_z1;
var bucketManager = new qiniu.rs.BucketManager(mac, qiniu_config)

//下面是cloudinary
cloudinary.config(config.cloudinary)




exports.getQiniuToken = function(body){
  var type = body.type
  var key = uuid.v4()
  var putPolicy
  var bucket

  if(type === 'avatar') {
    key += '.jpeg'
    bucket = 'gougouavatar'
    var options = {
      scope: bucket + ":" + key
    }
    putPolicy = new qiniu.rs.PutPolicy(options)
  }

  else if (type === 'video') {
    key += '.mp4'
    bucket = 'gougouvideo'

    var options = {
    scope: bucket + ':' + key,
    persistentOps: 'avthumb/mp4/an/1', // 查看qiniu数据处理的 音视频转码 ，这里是把上传的转成mp4同时，去除音频，an/0是保留音频
    persistentPipeline: "video-pipe", ///数据处理队列名称，必填
    //数据处理完成结果通知地址
    persistentNotifyUrl: config.notify
}

    putPolicy = new qiniu.rs.PutPolicy(options)
  }
//http://api.qiniu.com/status/get/prefop?id=z0.5983da3345a2650c99e1463  音频转码处理完成的结果通知地址
//后面的id就是返回的qiniu返回的去除音频的，打开后里面是一个json，里面的hash后面那个key就是 把音频去掉的结果

  else if (type === 'audio') {

  }

  var token = putPolicy.uploadToken(mac)

  return {
    key: key,
    token: token
  }
}

//http://cloudinary.com/documentation/upload_videos#uploading_from_server_side_code 有对文档的介绍
// cloudinary.v2.uploader.upload(file,
//         { resource_type: "video",
//           <optional_parameters...> },
//         function(result) {console.log(result); });
//下面是封装了一个Promise用来返回结果去做then，这样就不仅仅只是上传，还可以拿到返回的结果



exports.uploadToCloudinary = function(url){
  return new Promise(function(resolve, reject){
    cloudinary.uploader.upload(url, function(result){
      if(result && result.public_id){
        resolve(result)
      }
      else {
        reject(result)
      }
    },{
      resource_type: 'video',
      folder: 'video'
    })
  })
}

exports.saveToQiniu = function(resUrl, key){
  console.log('save to qinius  url')
  console.log(resUrl)
  console.log(key)

  return new Promise(function(resolve, reject){
    bucketManager.fetch(resUrl, 'gougouvideo', key, function(err, respBody, respInfo) {
      if (err) {
        console.log(err + ' when to saveToQiniu')
        reject(err)
        //throw err;
      } else {
        if (respInfo.statusCode === 200) {
          console.log(respBody.key)
          console.log(respBody.hash)
          console.log(respBody.fsize)
          console.log(respBody.mimeType)
          resolve(respBody)

        } else {
          console.log(respInfo.statusCode)
          console.log(respBody)
        }
      }
    });
  })
}



exports.getCloudinaryToken = function(body){
  var type = body.type
  var timestamp = body.timestamp
  var folder
  var tags


  if(type=== 'avatar'){
    folder = 'avatar'
    tags ='app,avatar'
  }
  else if (type==='video') {
    folder='video'
    tags == 'app,video'
  }

  else if (type === 'audio'){
    folder = 'audio'
    tags = 'app,audio'
  }

  var signature = 'folder=' + folder + '&tags=' + tags + '&timestamp=' + timestamp
  + config.cloudinary.api_secret

  var key = uuid.v4()

  signature = sha1(signature)


  return {
    key: key,
    token: signature  //返回给客户端的签名
}
}
