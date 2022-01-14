const puppeteer = require('puppeteer')
const PDFMerge = require('easy-pdf-merge')
const { join } = require('path')
const { dev } = require('vuepress')
const { fs, logger, chalk } = require('@vuepress/shared-utils')
const { red, yellow, gray } = chalk

// Keep silent before running custom command.
logger.setOptions({ logLevel: 1 })

module.exports = (opts = {}, ctx) => ({
  name: 'vuepress-plugin-export',

  chainWebpack(config) {
    config.plugins.delete('bar')
    // TODO vuepress should give plugin the ability to remove this plugin
    config.plugins.delete('vuepress-log')
  },

  extendCli(cli) {
    cli
      .command('export [targetDir]', 'export current vuepress site to a PDF file')
      .allowUnknownOptions()
      .action(async (dir = '.') => {
        dir = join(process.cwd(), dir)

        // for(var key in ctx.pages) {
        //   console.log(key, ctx.pages[key]);
        // }

        try {
          const nCtx = await dev({
            sourceDir: dir,
            clearScreen: false,
            theme: opts.theme || '@vuepress/default'
          })
          logger.setOptions({ logLevel: 3 })
          logger.info(`Start to generate current site to PDF ...`)
          try {
            await generatePDF(ctx, nCtx.devProcess.port, 'localhost')//nCtx.devProcess.host)
          } catch (error) {
            console.error(red(error))
          }
          nCtx.devProcess.server.close()
          process.exit(0)
        } catch (e) {
          throw e
        }
      })
  }
})

async function generatePDF(ctx, port, host) {
  const { pages, tempPath, siteConfig } = ctx
  const tempDir = join(tempPath, 'pdf')
  fs.ensureDirSync(tempDir)

  let exportPages = [];
  let navList = ctx.themeConfig.nav.map(n => n.link);
  //console.log(ctx.themeConfig.nav);
  for(var i=0; i<navList.length; i++) {
    const nav = navList[i];
    if(!ctx.themeConfig.sidebar[nav] || !ctx.themeConfig.sidebar[nav][0]) {
      continue;
    }
    for(var j=0; j<ctx.themeConfig.sidebar[nav][0].children.length; j++) {
      let child = ctx.themeConfig.sidebar[nav][0].children[j];
      //console.log('child', `"${child}"`);
      if(child != '') {
        child += '.html';
      }
      //console.log('finding', nav + child);
      const page = pages.find(p=> {
        return p.path == (nav + child);
      });
      if(!page) continue;
      //console.log('page found', page);
      exportPages.push({
        url: page.path,
        title: page.title,
        location: `http://${host}:${port}${page.path}`,
        path: `${tempDir}/${page.key}.pdf`
      });
    }
  }

  /*const exportPages = pages.map(page => {
    return {
      url: page.path,
      title: page.title,
      location: `http://${host}:${port}${page.path}`,
      path: `${tempDir}/${page.key}.pdf`
    }
  })*/

  const browser = await puppeteer.launch()
  const browserPage = await browser.newPage()

  for (let i = 0; i < exportPages.length; i++) {
    const {
      location,
      path: pagePath,
      url,
      title
    } = exportPages[i]

    await browserPage.goto(
      location,
      { waitUntil: 'networkidle2' }
    )

    await browserPage.pdf({
      path: pagePath,
      format: 'A4'
    })

    logger.success(
      `Generated ${yellow(title)} ${gray(`${url}`)}`
    )
  }

  const files = exportPages.map(({ path }) => path)
  const outputFilename = siteConfig.title || 'site'
  const outputFile = `${outputFilename}.pdf`
  await new Promise(resolve => {
    PDFMerge(files, outputFile, err => {
      if (err) {
        throw err
      }
      logger.success(`Export ${yellow(outputFile)} file!`)
      resolve()
    })
  })

  await browser.close()
  fs.removeSync(tempDir)
}


