self.importScripts('https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.js');
self.onmessage = async (event) => {
    const { partList } = event.data;
    const spark = new self.SparkMD5.ArrayBuffer();
    let percent = 0;
    const perSize = 100 / partList.length;
    const buffers = await Promise.all(partList.map(({ chunk }) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(chunk);
        reader.onload = (e) => {
            percent += perSize;
            self.postMessage({ percent: Number(percent.toFixed(2)) });
            resolve(e.target.result);
        }
        reader.onerror = (err) => {
            reject(err)
            self.close()
        }
    })));
    buffers.forEach(buffer => spark.append(buffer));
    self.postMessage({ percent: 100, hash: spark.end() });
    self.close();
}
