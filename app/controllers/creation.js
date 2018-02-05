'user strict'

var mongoose = require('mongoose')
var xss = require('xss')
var _ = require('lodash')
var Video = mongoose.model('Video')
var Creation = mongoose.model('Creation')
var Audio = mongoose.model('Audio')
var Promise = require('bluebird')
var config = require('../../config/config')

var robot = require('../service/robot')


exports.up = async (ctx, next) => {
  var body = ctx.request.body
  var user = ctx.session.user
  var creation = await Creation.findOne({
    _id: body.id
    })

  if(!creation){
    ctx.body = {
      success: false,
      err: 'no creation'
    }
    return
  }

  if (body.up === 'yes'){
    creation.votes.push(String(user._id))
  }
  else {
    creation.votes = _.without(creation.votes, String(user._id))  //把这个user从votes里面踢出去
  }

  creation.up = creation.votes.length  //统计votes里面有几个id，就是几个点赞
  await creation.save()

  ctx.body = {
    success: true
  }

}



var userFields = [
  'avatar',
  'nickname',
  'gender',
  'age',
  'breed'
]

exports.find = async (ctx, next) => {
  var feed = ctx.query.feed
  var cid = ctx.query.cid
  var count = 5

  var query = {
  }

  if (cid) {
    if (feed === 'recent') {
      query._id = {'$gt': cid}  // mongodb的条件查询，大于
    }
    else {
      query._id = {'$lt': cid}
    }
  }

  console.log('what is query for video')
  console.log(query)
  //下来刷新的时候，打印的结果是{ _id: { '$gt': '5a6e944ce5def6352b4bcf86' } }


  var creation  = await Creation
   .find(query)
   .sort({
     'meta.createAt': -1
   })
   .limit(count)
   .populate('author', userFields.join(' '))
   //monogdb的 creations的表格内容里面的author只是一个 objectid，pupulate就是额外把author的字段扩展后发给前端，另外包括creations本身内容
   //存到前端的dataSource里面，进而传到row里面

   var total = await Creation.count({})
  //上面每一个查询都是异步的，等于是同步，第一个查询完，才会进行下一个查询； 下面的数组方式有问题，查询是整个数组里面的两个元素都查询完成后，再返回结果


   ctx.body = {
     success: true,
     data: creation,
     total: total
   }
}

// // 下面查询的方法是用page的老办法
// exports.find = async (ctx, next) => {
//   var page  = parseInt(ctx.query.page, 10) || 1
//   var count = 5
//   var offset = (page - 1) * count
//
//
//   var creation  = await Creation
//    .find({})
//    .sort({
//      'meta.createAt': -1
//    })
//    .skip(offset)
//    .limit(count)
//    .populate('author', userFields.join(' '))
//    //monogdb的 creations的表格内容里面的author只是一个 objectid，pupulate就是额外把author的字段扩展后发给前端，另外包括creations本身内容
//    //存到前端的dataSource里面，进而传到row里面
//
//    var total = await Creation.count({})
//   //上面每一个查询都是异步的，等于是同步，第一个查询完，才会进行下一个查询； 下面的数组方式有问题，查询是整个数组里面的两个元素都查询完成后，再返回结果
//
//   //  var queryArray = [
//   //    Creation
//   //     .find({})
//   //     .sort({
//   //       'meta.createAt': -1
//   //     })
//   //     .populate('author'),
//    //
//   //     Creation.count({})
//   //  ]
//    //
//   //  var data = await queryArray
//
//    ctx.body = {
//      success: true,
//      data: creation,
//      total: total
//    }
// }

function asyncMedia(videoId, audioId){


  if(!videoId) return

  var query = {
    _id: audioId
  }

  if(!audioId) {   //这是针对 exports.video 里面的 asyncMedia方法，里面没有audioId
    query = {
      video: videoId
    }
  }

  Promise.all([   //  先查询到视频和音频都有，再将两个拼接，因为下面很多函数是异步，会导致视频还没上传完毕，就开始拼接
    Video.findOne({
      _id: videoId
    }),
    Audio.findOne(query)
  ])
  .then((data)=>{
    var video = data[0]
    var audio = data[1]
    console.log('check data')
      if(!video || !video.public_id || !audio || !audio.public_id){
        return
      }

      console.log('start combine')

      var video_public_id = video.public_id
      var audio_public_id = audio.public_id.replace(/\//g, ':')  //多层文件夹用冒号标示层级关系,  正则替换，g是全局， 本来只是替换‘／’
      var videoName = video_public_id.replace(/\//g, '_') + '.mp4'
      var videoURL = 'http://res.cloudinary.com/bobolin/video/upload/e_volume:-100/e_volume:400,l_video:' + audio_public_id + '/' +
      video_public_id + '.mp4'

      var thumbName = video_public_id.replace(/\//g, '_') + '.jpg'
      var thumbURL = 'http://res.cloudinary.com/bobolin/video/upload/' + video_public_id + '.jpg'


        console.log('async video to qiniu')

      robot
          .saveToQiniu(videoURL, videoName)
          .catch(function(err){
            console.log(err)
          })
          .then(function(response){
            if(response && response.key) {

              console.log('this is saveToQiniu s response of video')

              console.log(response)
              audio.qiniu_video = response.key    // 通过地址拼接，处理音频和视频的合并，然后上传到qiniu, 这里到response.key就是合并后到结果了
              audio.save().then(function(_audio){  //将合并后到结果save到 database里面到audio表格里面，保证视频上传qiniu完毕后，才去进行creation
                Creation.findOne({
                  video: video._id,
                  audio: audio._id
                })
                .then(function(_creation){
                  if(_creation){
                    if(!_creation.qiniu_video){
                      _creation.qiniu_video = _audio.qiniu_video
                      _creation.save()
                    }
                  }
                })

              })
              console.log('async video complete')
            }
          })


        console.log('async thumb to qiniu')

      robot
          .saveToQiniu(thumbURL, thumbName)
          .catch(function(err){
            console.log(err)
          })
          .then(function(response){
            if(response && response.key) {
              audio.qiniu_thumb = response.key
              audio.save().then(function(_audio){

                Creation.findOne({
                  video: video._id,
                  audio: audio._id
                })
                .then(function(_creation){
                  if(_creation){
                    if(!_creation.qiniu_video){
                      _creation.qiniu_thumb = _audio.qiniu_thumb
                      _creation.save()
                    }
                  }
                })
              })
              console.log('async thumb complete')
            }
          })

  })


}

//qiniu的response(hash,key,persistentId)上传到 mongodb到video目录，如果找不到，就new新的进去
exports.video = async (ctx, next) =>{

  var body = ctx.request.body
  var videoData = body.video
  var user = ctx.session.user
 console.log('i am  body.video')
 console.log(videoData)
  if(!videoData || !videoData.key){
    ctx.body = {
      success: false,
      err: 'no video uploaded to database'
    }
    return
  }

  var video = await Video.findOne({
    qiniu_key: videoData.key
  })

  if(!video) {
    video = new Video({
      // author: user._id,
      qiniu_key: videoData.key,
      persistentId: videoData.persistentId
    })

    video = await video.save()
  }

//拿到在qiniu空间的视频地址,上传到cloudinary，通过cloudinary处理这个视频，返回的结果更新 mongodb里面的那段视频
  var url = config.qiniu.video + video.qiniu_key

  robot
    .uploadToCloudinary(url)
    .then((data)=>{
        if(data && data.public_id){
          video.public_id = data.public_id
          video.detail = data

          video.save().then((_video)=>{
            asyncMedia(_video._id)
          })
        }
      })

  ctx.body ={
    success: true,
    data: video._id
  }
}

exports.audio = async (ctx, next) =>{
  var body = ctx.request.body
  var audioData = body.audio  // 这个就是 包含public_id等一大坨信息的detail
  var videoId = body.videoId  // 这个是用来指向对应videoId的
  var user = ctx.session.user


  if(!audioData || !audioData.public_id){
    ctx.body = {
      success: false,
      err: 'no audio uploaded to database'
    }
    return
  }

  var audio = await Audio.findOne({
    public_id: audioData.public_id
  })

  var video = await Video.findOne({
    _id: videoId     //看看在video里面能不能找到对应到audio 到那个id
  })


  if(!audio) {
    var _audio ={
      author: user._id,
      public_id: audioData.public_id,
      detail: audioData
    }

    if(video){
      _audio.video = video._id   //如果 _id能找到， audio里面增加video 参数， 值为video._id
    }

    audio = new Audio(_audio)

    audio = await audio.save()   // 如果不写await 就是promise了
  }

  //这是异步操作
  asyncMedia(video._id, audio._id)  //音频保存到databse之后，asyncMedia方法，会合并音频和视频，并且保存到qiniu

  ctx.body ={
    success: true,
    data: audio._id
  }
}

exports.save = async (ctx, next) =>{   // 将视频和音频合并后，保存到databse
  var body = ctx.request.body
  var audioId = body.audioId
  var videoId = body.videoId
  var title = body.title
  var user = ctx.session.user

  console.log('videoId and audioId for save ')

  console.log(audioId)
  console.log(videoId)
  var video = await Video.findOne({
    _id: videoId
  })

  var audio = await Audio.findOne({
    _id: audioId
  })

  if(!video || !audio) {
    ctx.body = {
      success: false,
      err: 'no video or audio'
    }
    return
  }

  var creation = await Creation.findOne({    // 因为Creation的schema里面有 video 和audio的ref, 所以可以直接找audioid 和videoid
    audio: audioId,
    video: videoId
  })

  if(!creation){
    var creationData = {
      author: user._id,
      title: title,
      audio: audioId,
      video: videoId,
      finish: 20,
    }

    var video_public_id = video.public_id
    var audio_public_id = audio.public_id

    //下面cloudinary的地址拼接，只是给databse里面的creation表格做一个合并视频的备份。
    if(video_public_id && audio_public_id) {
      creationData.cloudinary_thumb = 'http://res.cloudinary.com/bobolin/video/upload/' + video_public_id + '.jpg'
      creationData.cloudinary_video = 'http://res.cloudinary.com/bobolin/video/upload/e_volume:-100/e_volume:400,l_video:'
      + audio_public_id.replace(/\//g, ':') + '/' + video_public_id+ '.mp4'
      console.log('this is my url for qiniu')
      console.log(creationData.cloudinary_video)
      creationData.finish += 20
    }

    if(audio.qiniu_thumb) {
      creationData.qiniu_thumb = audio.qiniu_thumb
      creationData.finish += 30
    }
//添加qiniu_video给creationData， 并且把database的audio表格里面已经合并好的结果赋值给 creation 表格里面的qiniu_video
    if(audio.qiniu_video) {
      creationData.qiniu_video = audio.qiniu_video
      creationData.finish += 40
    }

    console.log('this is creation data from save')
    console.log(creationData)
    creation = new Creation(creationData)

    creation = await creation.save()
  }


  ctx.body ={
    success: true,
    data: {
      _id: creation._id,
      finish: creation.finish,
      title: creation.title,
      qiniu_thumb: creation.qiniu_thumb,
      qiniu_video: creation.qiniu_video,
      author: {
        avatar: user.avatar,
        nickname: user.nickname,
        gender: user.gender,
        breed: user.breed,
        _id: user._id
      }

    }
  }
}
