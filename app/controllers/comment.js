'user strict'

var mongoose = require('mongoose')
var Comment = mongoose.model('Comment')
var Creation = mongoose.model('Creation')



var userFields = [
  'avatar',
  'nickname',
  'gender',
  'age',
  'breed'
]



exports.find = async (ctx, next) => {
  var cid = ctx.query.cid     //加这个cid会 把对应这个creations（唯一._id）所有评论都加载出来，query就是前端get里面的 body参数
  var id = ctx.query.id
  var feed = ctx.query.feed
  var count = 5
  var query = {
    creation: cid
  }
  console.log('what is comments ctx here')
  console.log(ctx.query)

  console.log('what is comments query here')
  console.log(query)  //读取的结果是{ accessToken: 'user.accessToken', cid: '', id: '5a6b500647bffd684adeb23e' }
  if(!cid){
    ctx.body = {
      success: false,
      err: 'id cannot be blank'
    }
    return
  }

  if (id) {
    if (feed === 'recent') {
      query._id = {'$gt': id}
    } else {
      query._id = {'$lt': id}
    }
  }

  var comments  = await Comment
   .find(query)  //寻找mongoose里面，comment 下面creation参数值是 id的所有结果
   .sort({
     'meta.createAt': -1
   })
   .populate('replyBy', userFields.join(' '))
   .limit(count)

   var total = await Comment.count({creation: cid})


  ctx.body ={
    success: true,
    data: comments,
    total: total
  }
}


// // 下面查询的方法，需要更新，用cid，而不是page
//
// exports.find = async (ctx, next) => {
//   var id = ctx.query.cid     //加这个cid会 把对应这个creations（唯一._id）所有评论都加载出来，query就是前端get里面的 body参数
//   console.log('what is query id here')
//
//   console.log(ctx.query)  //读取的结果是{ accessToken: 'user.accessToken', cid: '', id: '5a6b500647bffd684adeb23e' }
//   if(!id){
//     ctx.body = {
//       success: false,
//       err: 'id cannot be blank'
//     }
//     return
//   }
//
//
//   var comments  = await Comment
//    .find({creation: id})  //寻找mongoose里面，comment 下面creation参数值是 id的所有结果
//    .sort({
//      'meta.createAt': -1
//    })
//    .populate('replyBy', userFields.join(' '))
//
//    var total = await Comment.count({creation: id})
//
//
//   ctx.body ={
//     success: true,
//     data: comments,
//     total: total
//   }
// }

exports.save = async (ctx, next) =>{
  var commentData = ctx.request.body.comment
  var user = ctx.session.user


  var creation = await Creation.findOne({
    _id: commentData.creation
  })


  if(!creation) {
    ctx.body = {
      success: false,
      err: 'no video'
    }
    return
  }

  var comment

  if(commentData.cid) {
    comment  = await Comment.findOne({
      _id: commentData.cid
    })

    var reply = {
      from: commentData.from,
      to: commentData.tid,
      content: commentData.content
    }

    comment.reply.push(reply)
    comment = await comment.save()

    ctx.body ={
      success: true
    }
  }

    else {
      comment  = new Comment({
        creation: creation._id,
        replyBy: user._id,
        replyTo: creation.author,
        content: commentData.content
      })

      comment = await comment.save()

      ctx.body ={
        success: true,
        data: [comment]
      }
    }

  }
