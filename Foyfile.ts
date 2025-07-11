import { task, desc, option, fs, setGlobalOptions } from 'foy'
setGlobalOptions({ loading: false, strict: true })

task('watch', async (ctx) => {
  // Your build tasks
  await Promise.all([
    ctx.exec('tsc -w -p ./'),
    ctx.cd('./media-src').exec('bun start'),
  ])
})

task('build', async (ctx) => {
  await Promise.all([
    ctx.exec('tsc -p ./'),
    ctx.cd('./media-src').exec('bun run build'),
  ])
  await ctx.exec('git add -A')
})
