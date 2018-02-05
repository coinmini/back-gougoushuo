'user strict'

var mongoose = require('mongoose')
var User = mongoose.model('User')
var robot = require('../service/robot')


exports.signature = ctx =>{

  var body = ctx.request.body
  var cloud = body.cloud
  var data

  if(cloud === 'qiniu') {

    data = robot.getQiniuToken(body)

  }

  else{
    data = robot.getCloudinaryToken(body)
  }

  ctx.body = {
    success: true,
    data: data
  }
}



// 下面两个是中间件，检查请求的是否有body，或者accessToken

exports.hasBody = async (ctx, next) =>{
  var body = ctx.request.body || {}

  if(Object.keys(body).length === 0) {
     ctx.body = {    // return加在ctx前面 可以返回当前ctx.body的内容，而不会再往下执行 await next()
      success: false,
      err: 'no content'
    }
    return  //加这里也可以
  }
  await next()
}


exports.hasToken = async (ctx, next) =>{
var accessToken = ctx.query.accessToken
console.log('has accessToken??')
console.log(accessToken)
if(!accessToken){
  var accessToken = ctx.request.body.accessToken
}


if(!accessToken){
   ctx.body ={
    success: false,
    err: 'no accessToken'
  }
  return
}


var user = await User.findOne({
  accessToken: accessToken
})

if(!user){
   ctx.body ={
    success: false,
    err: 'not login'
  }
  return
}

ctx.session = ctx.session || {}
ctx.session.user = user
await next()

}
