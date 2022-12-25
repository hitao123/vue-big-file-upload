const express = require('express')
const cors = require('cors')
const multiparty = require('multiparty')
const path = require('path')
const fs = require('fs-extra')
const logger = require('morgan')

const app = express()
const PUBLIC_DIR = path.resolve(__dirname, 'public')
const TEMP_DIR = path.resolve(__dirname, 'temp')
const DEFAULT_SIZE = 1024 * 1024 * 10;

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(express.static(PUBLIC_DIR))


app.get('/', function (req, res) {
    res.send('hello world')
})

app.post('/uploadAll', async (req, res, next) => {
    const form = new multiparty.Form();
    //设置编辑
    form.encoding = 'utf-8';
    //设置文件存储路径
    //设置单文件大小限制 
    form.maxFilesSize = 200 * 1024 * 1024;
    // 这里在真实的场景应该是上传到 cdn 上，会有对应 node sdk 进行上传
    form.parse(req, async (err, fields, files) => {
        if (err) return next(err)
        const name = fields.name[0]
        const file = files.files[0]
        console.log(name, file)
        await fs.move(file.path, path.resolve(PUBLIC_DIR, file.originalFilename), { overwrite: true })
        res.json({
            success: true,
            fileName: file.originalFilename,
        })
    })
})

/**
 * 上传
 */
app.post('/upload', async (req, res, next) => {
    const form = new multiparty.Form()
    form.parse(req, async (err, fields, files) => {
        if (err) return next(err)
        const name = fields.name[0]
        const file = files.files[0]
        await fs.move(file.path, path.resolve(PUBLIC_DIR, name), { overwrite: true })
        res.json({
            success: true
        })
    })
})

/**
 * 校验
 */
app.get('/verify/:fileName', async (req, res, next) => {
    const { fileName } = req.params
    const filePath = path.resolve(PUBLIC_DIR, fileName)
    const existFile = await fs.pathExists(filePath)
    if (existFile) {
        res.json({
            code: 200,
            msg: 'success',
            data: {
                needUpload: false,
            },
        })
        return
    }

    const folderPath = path.resolve(TEMP_DIR, fileName)
    const existFolder = await fs.pathExists(folderPath)

    let uploadedList = []

    if (existFolder) {
        uploadedList = await fs.readdir(folderPath)
        uploadedList = await Promise.all(uploadedList.map(async (fileName) => {
            const stat = await fs.stat(path.resolve(folderPath, fileName))
            return {
                fileName,
                size: stat.size,
            }
        }))
    }

    res.json({
        code: 200,
        msg: 'success',
        data: {
            needUpload: true,
            uploadedList,
        }
    })
})


app.post('/partUpload/:fileName/:start/:chunkName', async (req, res, next) => {
    const { fileName, chunkName, start } = req.params
    const folderPath = path.resolve(TEMP_DIR, fileName)
    const existFolder = await fs.pathExists(folderPath)
    if (!existFolder) {
        await fs.mkdirs(folderPath)
    }

    const filePath = path.resolve(folderPath, chunkName)
    const ws = fs.createWriteStream(filePath, {
        start: Number(start),
        flags: 'a',
    })

    req.on('end', () => {
        ws.close()
        res.json({
            code: 200,
            msg: 'success',
            data: true,
        })
    })
    req.on('error', () => {
        ws.close()
    })
    req.on('close', () => {
        ws.close()
    })
    req.pipe(ws)
})


app.get('/merge/:fileName', async (req, res, next) => {
    const { fileName } = req.params
    try {
        await mergeChunks(fileName)
        res.json({
            code: 200,
            msg: 'success',
            data: true,
        })
    } catch (error) {
        res.json({
            code: 1,
            msg: 'error',
            data: false,
        })
    }
})


const getIndex = (str) => {
    const matched = str.match(/-(\d{1,})$/)
    return matched ? Number(matched[1]) : 0
}

const pipeStream = (filePath, ws) => {
    return new Promise((resolve, _reject) => {
        const rs = fs.createReadStream(filePath)
        rs.on('end', async () => {
            await fs.unlink(filePath)
            resolve()
        })
        rs.pipe(ws)
    })
}


const mergeChunks = async (fileName, size = DEFAULT_SIZE) => {
    const filePath = path.resolve(PUBLIC_DIR, fileName)
    const folderPath = path.resolve(TEMP_DIR, fileName)
    const folderFiles = await fs.readdir(folderPath)
    folderFiles.sort((a, b) => getIndex(a) - getIndex(b))

    await Promise.all(folderFiles.map((chunk, index) => 
        pipeStream(
            path.resolve(folderPath, chunk),
            fs.createWriteStream(filePath, {
                start: index * size
            })
        )
    ))
    await fs.rmdir(folderPath)
}

app.listen(3000, () => {
    console.log('listening on port 3000')
})