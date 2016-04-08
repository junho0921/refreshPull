define(function (require, exports, module) {
	/*
	* 改动范围:
	* 取消作用wrap, 只作用icon, 不能修改DOM结构, 而且取消上拉的icon效果变为模拟scrollTouch
	* 具体改动操作;
	* 1, delete 变量_$funcIconWrap// okay
	* 删除 _$topIconWrap, _$footIconWrap // okay
	 * 2, 删除方法_setIconPos // okay
	 * 4, 把raf, transition等等的外包给cssPropJs // okay
	 *      4-1, 最后处理_setCssProps的外包 // okay
	 * 5, _dragIcon的奇怪命名, this._draggingY本来就应该有正负
	 * 6, 改变了_setIconRun方法, 使用raf不断累减icon的角度来实现滚动, 控制滚动速度的方法是监听时间变化, 与配置的滚动速度来设icon角度// okay
	* */

	var Refresh = module.exports = function(wrapper, config){
		this.initialize(wrapper, config);
	};

	Refresh.prototype = {

		initialize: function(wrapper, config){
			this._config = $.extend({}, this._defaultConfig, config);

			// 设定容器
			this._setTarget($(wrapper), config);

			// 生成icon
			this._buildIcon();

			// 根据用户的设定来计算icon拖拽时的滚动速度等等
			this._calcRuns();

			// 绑定事件
			this._$container.on($.fn._touchStart, $.proxy(this._onTouchStart, this));
		},

		_defaultConfig: {
			// 拖拽icon的最大距离, 也是触发加载的距离边缘
			triggerOffset: 150,
			// 公开方法: 重新获取数据
			refreshData: null,
			// 公开方法: 加载更多数据
			loadMoreData: null,
			// 公开方法: 模板
			dataRenderer: null
		},

		_saveData:{
			dragY:0,
			deg:0
		},

		_staticConfig:{
			// 收回icon的回滚次数
			resetRuns: 2,
			// 收回icon的回滚时间
			resetDuration: 1000,
			// icon
			topIconWrapperClass: 'nu-refreshPull PullUp',
			footerIconWrapperClass: 'nu-refreshPull PullDown',
			iconCss: {position: 'absolute', 'z-index': 999, opacity: 1},
			iconRenderer: function(){
				return $('<img src="./img/iconfont-loading.png">');
			},

			// 拖拽距离与icon滚动距离的比例
			_dragOffsetScale: 3
		},

		STATUS_PULLING_DOWN: 1,

		STATUS_TRIGGER_PULL_DOWN: 2,

		STATUS_PULLING_UP: 3,

		STATUS_TRIGGER_PULL_UP: 4,

		_status: null,

		_iconDeg: 0,

		/*设定外框wrapper与滚动框container, 注意这里会改变DOM结构*/
		_setTarget: function($wrapper){
			$wrapper.css({position: 'relative', overflow: 'hidden'});

			this._wrapperH = $wrapper.outerHeight();

			if(this._config.containerSelector){
				this._$container = $wrapper.find(this._config.containerSelector);
			}else{
				this._$container = $wrapper.children().eq(0);
			}

			// 给内容添加一个外框作为scroll的容器
			this._$container.wrap('<div>');

			this._$wrapper = this._$container.parent()
				.css({
					"overflow-y": "auto",
					"-webkit-overflow-scrolling": "touch",
					height: this._wrapperH
				});
		},

		/*计算icon滚动的数据*/
		_calcRuns: function(){
			// icon滚一圈所用时间
			this._circleDuration = this._staticConfig.resetDuration / this._staticConfig.resetRuns;

			// icon每滚1deg所变化的高度
			this._dragDegPerY = (this._staticConfig.resetRuns * 360) / this._config.triggerOffset;

			// icon每滚1deg所过渡的时间
			this._resetDegPerTime = 360 / this._circleDuration;

			this._dragOffset = this._config.triggerOffset * this._staticConfig._dragOffsetScale;
		},

		_buildIcon: function(){
			var topIconWrap, footIconWrap;
			this._$wrapper.before(
				topIconWrap = $('<div>')
					.addClass(this._staticConfig.topIconWrapperClass)
					.css(this._staticConfig.iconCss)
					.append(
						this._$topIcon = this._staticConfig.iconRenderer()
					)
			);
			// 仅在有配置loadMoreData方法才生产底部icon
			if(this._config.loadMoreData){
				this._$wrapper.after(
					footIconWrap = $('<div>')
						.addClass(this._staticConfig.footerIconWrapperClass)
						.css(this._staticConfig.iconCss)
						.append(
							this._$footIcon = this._staticConfig.iconRenderer()
						)
				);
			}
			var iconH = topIconWrap.outerHeight() * 1.1;
			//取得高度后设icon的位置
			topIconWrap.css({top: -iconH + 'px', bottom: 'auto'});
			footIconWrap && footIconWrap.css({top: 'auto', bottom: -iconH + 'px'});
		},

		_onTouchStart: function(e){
			if(this._status){//console.log("正在处理中");
				return
			}
			this._startScrollTop = this._$wrapper.scrollTop();
			// 获取初始坐标
			this._touchBeginY = this._getY(e);
			// 计算初始点击时, 离到达底部的拖拽距离
			this._footerDragDistance = this._$wrapper[0].scrollHeight - this._$wrapper[0].clientHeight - this._startScrollTop;
			// 绑定事件
			this._$container.on($.fn._touchMove, $.proxy(this._onTouchMove, this));
			this._$container.on($.fn._touchEnd, $.proxy(this._onTouchEnd, this));
		},

		_onTouchMove: function(e) {
			// 拖拽距离
			var moveY = this._getY(e) - this._touchBeginY;
			// 停止冒泡, 有意义的, 但我忘记了, 问龙森, 好像是浏览器有滚动的响应的
			e.stopPropagation();

			if(moveY > 0){
				// 拖拽到顶部后的拖拽间隔
				var pullDownY = moveY - this._startScrollTop;

				if(pullDownY > 0) { //console.log('pullDownY', pullDownY);
					this._status = pullDownY > this._config.triggerOffset ? this.STATUS_TRIGGER_PULL_DOWN : this.STATUS_PULLING_DOWN;
					e.preventDefault();
					this._draggingY = pullDownY;
					this._dragIcon(true);
				}
			}else{
				// 拖拽到底部后的拖拽间隔
				var pullUpY = -moveY - this._footerDragDistance;

				if(pullUpY > 0) { //console.log('pullUpY', pullUpY);
					this._status = pullUpY > this._config.triggerOffset ? this.STATUS_TRIGGER_PULL_UP : this.STATUS_PULLING_UP;
					e.preventDefault();
					this._draggingY = pullUpY;
					this._dragIcon(true);
				}
			}

		},

		_onTouchEnd: function(){
			var _this = this;//console.log('_onTouchEnd _status =', this._status);
			this._$container.off($.fn._touchMove + " " + $.fn._touchEnd);
			this._draggingIcon = false;

			if(this._status == this.STATUS_TRIGGER_PULL_DOWN){
				this._setIconRun();
				this._refreshData();
			}else if(this._status == this.STATUS_TRIGGER_PULL_UP){
				this._setIconRun();
				this._loadMoreData();
			}else if(this._status == this.STATUS_PULLING_DOWN || this._status == this.STATUS_PULLING_UP){
				this._resetIcon({
					callback: function(){
						_this._status = null;
					}
				});
			}

		},

		_setIconRun: function(){
			// 本方法是icon进入loading状态的不断滚动, 但有定时退出loading状态
			var _this = this;

			this._iconRunning = true;

			function getT(){
				return (new Date()).getTime();
			}
			
			var oTime = getT(), nTime, tSpace;

			(function IconRun (){
				if(!_this._iconRunning){return}

				// 计算时间间隔
				nTime = getT();
				tSpace = nTime - oTime;
				oTime = nTime;

				// 以旋转的速度乘以时间间隔得出, 现在icon应该旋转的角度
				rotateDeg = _this._resetDegPerTime * tSpace;//console.log('IconRun', rotateDeg);

				var iconDeg = _this._iconDeg - rotateDeg;

				_this._functionIconTransform(_this._iconPosY, iconDeg);

				$.fn.requestAnimationFrame(IconRun)
			}());
		},

		/*
		* 回收icon的方法
		* 几种情况:
		* 1, 中途回滚
		* 2, 加载完毕回滚
		* */
		_resetIcon: function(options){
			clearTimeout(this._timeFunc);
			this._iconRunning = false;

			var _this = this;
			var resetDuration, rotateDeg;

			if(this._status == this.STATUS_PULLING_DOWN || this._status == this.STATUS_PULLING_UP){
				// 情况是中途回滚
				resetDuration = this._iconDeg / 360 * this._circleDuration;
				rotateDeg = 0;
			} else {
				// 情况是加载完毕回滚
				resetDuration = this._staticConfig.resetDuration;
				rotateDeg = this._iconDeg - (this._staticConfig.resetRuns * 360);
			}

			// 设动画时间
			this._functionIconTransition(resetDuration);
			// 执行回滚
			this._functionIconTransform(0, rotateDeg);

			setTimeout(function(){
				// 设icon的css过渡都为0, 表示取消动画
				// 设动画时间
				_this._functionIconTransition(0);
				// 执行回滚
				_this._functionIconTransform(0, 0);

				_this._getFuncIcon(0);
				if(options && options.callback)options.callback();
			}, resetDuration);
		},

		_getY: function(e){
			var e = e.originalEvent || e;
			return ("changedTouches" in e) ? e.changedTouches[0].pageY : e.pageY;
		},

		_refreshData: function(){
			this._config.refreshData($.proxy(this._refreshRender, this));
		},

		_loadMoreData: function(){
			this._config.loadMoreData($.proxy(this._loadMoreRender, this));
		},

		_refreshRender: function(datas){
			this._clearItems();
			this._appendItems(datas);
		},

		_loadMoreRender: function(datas){
			this._appendItems(datas);
		},

		_clearItems: function(){
			this._$container.empty();
			this._items = [];
		},

		_appendItem: function(data){
			var item = this._config.dataRenderer(data);
			this._items.push(item);
			item.appendTo(this._$container);
		},

		_appendItems: function(datas){
			for(var i = 0; i < datas.length; i++){
				this._appendItem(datas[i]);
			}
			this._refresh();
		},

		_refresh: function(){
			var _this = this;
			if(this._items.length == 0){
				this._$container.append(
					this._noDataTipEl = $(this.NO_DATA_HTML).css("height", this._$wrapper.outerHeight(true))
				)
			}else{
				// 顺利获取数据的状态
				if(this._noDataTipEl){
					this._noDataTipEl.hide();
				}
			}
			this._resetIcon({
				callback: function(){
					_this._status = null;
				}
			});
		},

		/*选择当前操作的icon*/
		_getFuncIcon: function(mode){
			// 状态没有改变就不执行
			if(mode == this._mode){return}
			this._mode = mode;

			if(mode === this.STATUS_PULLING_DOWN){//console.log('选择top');
				this._$funcIcon = this._$topIcon.css('opacity', 1);
			} else if(mode === this.STATUS_PULLING_UP){//console.log('选择foot');
				this._$funcIcon = this._$footIcon.css('opacity', 1);
			} else if(!mode){//console.log('隐藏icon');
				this._$topIcon.css('opacity', 0);
				this._$footIcon && this._$footIcon.css('opacity', 0);
				this._$funcIcon = null;
			}
		},

		/*拖拽icon是交由rAF处理的*/
		_dragIcon: function(initOnly){

			if(initOnly && this._draggingIcon// 表示onTouchMove触发的拖拽, 因raf正处理, 所以应忽略
			){return}

			if(initOnly){
				this._draggingIcon = true;
				// 选择作用的icon
				this._getFuncIcon(this._status);
				// 清空过渡动画
				this._functionIconTransition(0);
			}

			var _this = this;
			(function rafDraggingIcon (){
				if(!_this._draggingIcon){return}
				var originalY = _this._draggingY < 0 ? -_this._draggingY : _this._draggingY,
					dragY = originalY;

				// 拖拽的角度
				var rotateDeg = dragY * _this._dragDegPerY;
				if(Math.abs(rotateDeg - _this._saveData.deg) >= 1){
					_this._saveData.deg = rotateDeg;
				}

				// 拖拽的距离
				if(dragY < _this._dragOffset){
					dragY = Math.sqrt((2 * _this._dragOffset - dragY) * dragY) / _this._staticConfig._dragOffsetScale;
					dragY = dragY > originalY ? originalY : dragY;

					if(Math.abs(dragY - _this._saveData.dragY) >= 1){
						_this._saveData.dragY = dragY;
					}
				}

				_this._functionIconTransform(_this._saveData.dragY, _this._saveData.deg);

				$.fn.requestAnimationFrame(rafDraggingIcon);
			}());
		},


		/*
		* icon的位置与旋转角度设置
		* */
		_functionIconTransform: function(distance, rotateDeg){

			var posProps = {};
			
			// 记录
			this._iconPosY = distance;
			this._iconDeg = rotateDeg;

			// 若是footIcon, 调整为反方向的位移
			if(this._mode == this.STATUS_PULLING_UP && distance > 0){distance = -distance}

			posProps[$.fn._animType] = "translate3D(0, " + distance + "px, 0) rotate(" + rotateDeg + "deg)"; //console.log(posProps);

			this._$funcIcon.css(posProps);
		},

		_functionIconTransition: function(duration){
			var transition = {};

			transition[$.fn._transitionType] = $.fn._transformType + ' ' + duration + 'ms linear';//console.log(transition);

			this._$funcIcon.css(transition);
		},

		/**
		 * @desc 触发"下拉刷新"事件,一般用于首次加载数据
		 * @memberof Nuui.Scroll
		 * @func triggerRefresh
		 * @instance
		 */
		triggerRefresh: function(){
			this._status = this.STATUS_TRIGGER_PULL_DOWN;
			this._getFuncIcon(this.STATUS_PULLING_DOWN);
			this._functionIconTransform(this._config.triggerOffset, 0);
			this._setIconRun();
			this._refreshData();
		},

		/**
		 * @desc 触发"退出加载状态"事件,一般用于同步服务器失败的回调方法里
		 * @memberof Nuui.Scroll
		 * @func triggerHide
		 * @instance
		 */
		triggerHide: function(){
			this._refresh();
		}
	}
});