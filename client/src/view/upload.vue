<template>
    <div>
        <input type="file" ref="input" class="file" @change="handleFile($event)">
        <div class="go-upload-trigger" @click="onClickTrigger">
            点击上传
        </div>
        <el-progress :percentage="percent"></el-progress>
    </div>
</template>

<script>
import axios from 'axios'
import Worker from '../lib/generateHash.worker.js'

const DEFAULT_SIZE = 10 * 1024 * 1024
const HOST = 'http://localhost:3000'

export default {
    name: 'UploadComponent',
    data() {
        return {
            currentFile: null,
            percent: 0,
            worker: null,
            fileName: '',
            partList: []
        }
    },
    mounted() {
        this.worker = new Worker()
    },
    destroyed() {
        this.worker.terminate()
    },
    methods: {
        onClickTrigger() {
            this.$refs.input.click();
        },
        handleFile(e) {
            this.currentFile = e.target.files[0]
            this.handlePartFile()
            e.target.value = '';
        },
        handlePartFile() {
            const partList = this.createChunks(this.currentFile);
            const lastDotIdx = this.currentFile.name.lastIndexOf('.');
            const extName = this.currentFile.name.slice(lastDotIdx);
            this.generateHash(partList).then(res => {
                const fileName = `${res}${extName}`;
                partList.forEach((part, index) => {
                    part.fileName = fileName;
                    part.chunkName = `${fileName}-${index}`;
                    part.loaded = 0;
                    part.percent = 0;
                })

                this.partList = partList
                this.fileName = fileName

                this.uploadParts(this.partList, this.fileName)
            })
        },
        /**
         * 创建 chunk List
         * @param {*} file 文件
         * @param {*} size 切割的 chunk 大小 默认 10M
         */
        createChunks(file, size = DEFAULT_SIZE) {
            let current = 0;
            const partList = [];
            while (current < file.size) {
                const chunk = file.slice(current, current + size);
                partList.push({
                    chunk,
                    size: chunk.size,
                })
                current += size
            }
            return partList;
        },
        /**
         * 生成文件 hash
         * @param {[]} partList 
         */
        generateHash(partList) {
            return new Promise((resolve, reject) => {
                this.worker.postMessage({ partList });
                this.worker.onmessage = (event) => {
                    const { hash } = event.data;
                    if (hash) {
                        resolve(hash);
                    }
                }

                this.worker.onerror = error => {
                    reject(error);
                }
            })
        },
        async uploadParts(partList, fileName) {
            const res = await axios.get(HOST + `/verify/${fileName}`)
            const { data } = res
            if (data.code == 200) {
                // 不需要重新上传，实现秒传
                if (!data.data.needUpload) {
                    this.$message('秒传成功');
                    this.partList = this.partList.map((part) => ({
                        ...part,
                        loaded: DEFAULT_SIZE,
                        percent: 100,
                    }))
                    return
                }

                try {
                    const { uploadedList } = data.data
                    const requestList = this.createRequestList(partList, uploadedList, fileName);
                    const partsRes = await Promise.all(requestList);
                    console.log(partList, uploadedList, partsRes)
                    if (partsRes.every(item => item.data.code === 200)) {
                        const res = await axios.get(HOST + `/merge/${fileName}`)
                        const { data } = res
                        if (data.code === 200) {
                            this.$message.success('上传成功');
                            this.reset()
                        } else {
                            this.$message.error('上传失败，请稍后重试~');
                        }
                    } else {
                        this.$message.error('上传失败，请稍后重试~');
                    }
                } catch (error) {
                    this.$message.error('上传失败或暂停');
                    console.error(error);
                }
            }
        },
        createRequestList(partList, uploadedList, fileName) {
            return partList.filter((part) => {
                const uploadedFile = uploadedList.find(item => item.fileName === part.chunkName);
                if (!uploadedFile) { // 此chunk还没上传过
                    part.loaded = 0;
                    part.percent = 0;
                    return true;
                }
                if (uploadedFile.size < part.chunk.size) { // 此chunk上传了一部分
                    part.loaded = uploadedFile.size;
                    part.percent = Number((part.loaded / part.chunk.size * 100).toFixed(2));
                    return true;
                }
                // 上传过了
                return false;
            }).map((part) => axios({
                method: 'POST',
                url: HOST + `/partUpload/${fileName}/${part.loaded}/${part.chunkName}`,
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                // setXhr: (xhr) => {
                //     part.xhr = xhr;
                // },
                onProgress: () => {
                    // part.percent = Number(((part.loaded + event.loaded) / part.chunk.size * 100).toFixed(2));
                    // console.log('part percent: ', part.percent)
                    // this.partList = [...partList]
                    // if (this.partList.length > 0 ) {
                    //     this.percent = this.partList.reduce((memo, curr) => memo + curr.percent, 0)
                    // } else {
                    //     this.percent = 0
                    // }
                },
                data: part.chunk.slice(part.loaded),
            }))
        },
        reset() {
            this.percent = 0
            this.partList = []
            this.fileName = ''
        }
    }
}
</script>

<style lang="less">
.file {
    // display: none;
    visibility: hidden;
}
</style>