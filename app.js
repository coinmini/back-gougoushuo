// 'use strict'
//
// var koa = require('koa')
// var logger = require('koa-logger')
// var session = require('koa-session')
// var bodyParser = require('koa-bodyparser')
// var app = new koa()
//
// app.keys = ['imooc']
// // app.use(logger())
// app.use(session(app))
// app.use(bodyParser())
//
// app.use(function *(next) {
//   console.log(this.href)
//   console.log(this.method)
      // this.body = {
      //   success: true
      // }
      // yield next
// })
// app.listen(1234)
//
// console.log('listening: 1234')


// 步骤：
// 1. 先上传视频，到qiniu，然后在node服务器端同步到cloudinary,再在node服务器端保存到mongodb 的video表格
// 2. 录音，+ preview
// 3. 点击下一步到时候，上传 纯audio 到cloudinary，将返回的结果，再保存到mongodb的audio表格里面,（这时都只是纯audio）
//    在node服务器端会触发 asyncMedia函数，对音频和视频进行拼接(cloudinary的地址拼接法),将这个拼接上传到qiniu，之后更新audio表格，添加拼接后都mp3
// 3 和 4 之间就会发生 进行creations的时候，3里面的视频上传到qiniu还没有完成，导致4里面拿不到合并好的视频
// 4. 把qiniu里面合并好到结果保存到mongodb的creations表格
var fs = require('fs')
var path = require('path')
var mongoose = require('mongoose')
var db = 'mongodb://192.169.136.56:27017/imooc-app'  //这里填local host

mongoose.Promise = require('bluebird')
mongoose.connect(db)

// 整个下面的文件读取操作可以用require代替，但是当文件比较多的时候，一个一个require进来就不合适了
// require('./app/models/user')

var models_path  = path.join(__dirname, '/app/models')  // 把models 路径引进来， 下面的方法就是去读取文件

var walk = function(modelPath) {
  fs
    .readdirSync(modelPath)
    .forEach(function(file){
      var filePath = path.join(modelPath, '/' + file)
      var stat = fs.statSync(filePath)

      if(stat.isFile()){    //如果是js文件 就加载
        if(/(.*)\.(js|coffe)/.test(file)) {
          require(filePath)
        }
      }
      else if (stat.isDirectory()){  // 如果下面还有文件
        walk(filePath)
      }
    })
}

walk(models_path)



const Koa = require('koa')
const logger = require('koa-logger')
const session = require('koa-session')
const bodyParser = require('koa-bodyparser')
const app = new Koa()
var router = require('./config/routes')()


app.keys = ['imooc']
app.use(logger())
app.use(session(app))
app.use(bodyParser())

//下面是 async 和await的用法， await直接代替yield
// app.use(async (ctx, next) => {
//   console.log(ctx.href)
//   console.log(ctx.method)
//   await next()
//   ctx.body += 'i am seconde'
//
// })
//
// app.use( ctx =>{
//   console.log('print me first')
//   ctx.body = 'i am first'
// }
// )


app
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(30000)
console.log('listening:30000')
