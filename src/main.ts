import fs from 'fs'
import {DataEntry, PdfReader} from 'pdfreader'
import _ from 'lodash'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import {glob} from 'glob'

const reader = new PdfReader({})

const PATH = '/Users/grech_ca/Library/Mobile Documents/com~apple~CloudDocs/–û—Ç—á–µ—Ç—ã/November 2023'

dayjs.extend(customParseFormat)
dayjs.locale('ru')

const getFileName = (date: string, currency: string) =>
  `Гречка ИП - ${date} - Выписка - Счет ${currency}.pdf`

const renameFile = (path: string, name: string) => new Promise<void>((resolve, reject) => {
  const splittedPath = _(path).trim('/').split('/')

  fs.rename(path, `${splittedPath.slice(0, splittedPath.length - 1)}/${name}`, (err) => {
    if (err) reject(err)
    else resolve()
  })
})

const parseFile = (path: string) => new Promise<DataEntry[]>((resolve, reject) => {
  let data: DataEntry[] = []
  reader.parseFileItems(path, (err, item) => {
    if (err) reject(err)
    else if (item) data.push(item)
    else if (!item) resolve(data)
  })
})

const decodeCyrillic = (text: string) => {
  const uint8Array = new Uint8Array(text.length);
  for (let i = 0; i < text.length; ++i) {
    uint8Array[i] = text.charCodeAt(i);
  }

  // Decode the Uint8Array using TextDecoder with appropriate encoding
  const decoder = new TextDecoder("windows-1251"); // You might need to experiment with different encodings
  const decodedText = decoder.decode(uint8Array);

  return decodedText
}

const statementsPaths = await glob('**/*.pdf', {ignore: 'node_modules/**'})
const statementsPromises = statementsPaths.map(async (path) => {
  const dataEntries = await parseFile(path)
  const textNodes = _(dataEntries)
    .filter('text')
    .groupBy('y')
    .mapValues(
      (items) => _(items)
        .compact()
        .map((item) => decodeCyrillic(item!.text!))
        .value()
    )
    .values()
    .value()

  const dateRow = _(textNodes).find(row => row[0].startsWith('Справка'))
  if (!dateRow) return

  const date = _.capitalize(dayjs(dateRow[1].split('-')[0], 'DD/MM/YY').format('MMMM YYYY'))

  const currencyRow = _(textNodes).find(row => row[0].startsWith('Начальный остаток'))

  if (!currencyRow) return

  const currency = currencyRow[1].slice(-3)

  const fileName = getFileName(date, currency)

  await renameFile(path, fileName)
})

await Promise.all(statementsPromises)

