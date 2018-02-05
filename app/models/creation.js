'use strict'

var mongoose = require('mongoose')
var ObjectId = mongoose.Schema.Types.ObjectId
var Mixed = mongoose.Schema.Types.Mixed

var CreationSchema = new mongoose.Schema({

  title: String,

  author:{
    type: ObjectId,
    ref: 'User'
  },

  video:{
    type: ObjectId,
    ref: 'Video'       //ref的话，可以查询到Video里面对应的_id
  },

  audio:{
    type: ObjectId,
    ref: 'Audio'
  },

  qiniu_thumb: String,
  qiniu_video: String,

  cloudinary_thumb: String,
  cloudinary_video: String,

  finish: {
    type: Number,
    default: 0
  },

  votes: [String],  //每一个用户的id
  up: {
    type: Number,
    default: 0
  },


//cloudinary
  public_id: String,
  detail: Mixed,

  meta: {
    createAt: {
      type:Date,
      default: Date.now()
    },
    updateAt: {
      type: Date,
      default: Date.now()
    }
  }
})

CreationSchema.pre('save', function(next) {
  if(this.isNew) {
    this.meta.createAt = this.meta.updateAt = Date.now()
  }
  else {
    this.meta.updateAt = Date.now()
  }
  next()
})


module.exports = mongoose.model('Creation', CreationSchema)
